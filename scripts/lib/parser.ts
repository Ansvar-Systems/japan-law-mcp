#!/usr/bin/env tsx
/**
 * Parser for e-Gov XML law data.
 *
 * Japanese law XML uses a hierarchical structure:
 *   編 (hen/Part) > 章 (shō/Chapter) > 節 (setsu/Section) > 条 (jō/Article)
 *   > 項 (kō/Paragraph) > 号 (gō/Item)
 *
 * This parser extracts articles with their hierarchical context.
 */

export interface ParsedArticle {
  articleNum: string;        // Arabic numeral (e.g., "17")
  articleTitle: string;      // Japanese article title if any
  content: string;           // Full Japanese text content
  part?: string;             // 編
  chapter?: string;          // 章
  section?: string;          // 節
  paragraphs: ParsedParagraph[];
}

export interface ParsedParagraph {
  paragraphNum: string;
  content: string;
  items: ParsedItem[];
}

export interface ParsedItem {
  itemNum: string;
  content: string;
}

export interface ParsedLaw {
  lawId: string;
  lawNum: string;
  lawName: string;
  preamble?: string;
  articles: ParsedArticle[];
  supplementaryProvisions: ParsedArticle[];
}

function extractText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);

  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }

  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;

    // Direct text node
    if ('#text' in obj) {
      return String(obj['#text']);
    }

    // Sentence elements
    if ('Sentence' in obj) {
      const sentences = Array.isArray(obj.Sentence) ? obj.Sentence : [obj.Sentence];
      return sentences.map(extractText).join('');
    }

    // Column/Line elements
    if ('Column' in obj) {
      return extractText(obj.Column);
    }

    // Collect all text from child elements
    const parts: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith('@_')) continue; // Skip attributes
      parts.push(extractText(val));
    }
    return parts.join('');
  }

  return String(node);
}

function parseArticleNum(articleNode: Record<string, unknown>): string {
  const num = articleNode['@_Num'];
  if (num != null) return String(num);
  const caption = extractText(articleNode['ArticleCaption'] ?? articleNode['ArticleTitle']);
  const match = caption.match(/第(\d+)/);
  return match ? match[1] : '0';
}

function parseItems(itemsNode: unknown): ParsedItem[] {
  if (!itemsNode) return [];
  const items = Array.isArray(itemsNode) ? itemsNode : [itemsNode];
  return items.map((item: Record<string, unknown>) => ({
    itemNum: String(item['@_Num'] ?? '0'),
    content: extractText(item['ItemSentence'] ?? item['Sentence'] ?? item),
  }));
}

function parseParagraphs(paraNode: unknown): ParsedParagraph[] {
  if (!paraNode) return [];
  const paras = Array.isArray(paraNode) ? paraNode : [paraNode];
  return paras.map((para: Record<string, unknown>) => ({
    paragraphNum: String(para['@_Num'] ?? '1'),
    content: extractText(para['ParagraphSentence'] ?? para['Sentence'] ?? para),
    items: parseItems(para['Item']),
  }));
}

function parseArticles(articlesNode: unknown, context: { part?: string; chapter?: string; section?: string } = {}): ParsedArticle[] {
  if (!articlesNode) return [];
  const articles = Array.isArray(articlesNode) ? articlesNode : [articlesNode];

  return articles.map((article: Record<string, unknown>) => {
    const articleNum = parseArticleNum(article);
    const articleTitle = extractText(article['ArticleCaption'] ?? article['ArticleTitle'] ?? '');
    const paragraphs = parseParagraphs(article['Paragraph']);
    const content = paragraphs.map(p => {
      let text = p.content;
      if (p.items.length > 0) {
        text += '\n' + p.items.map(i => `  ${i.itemNum}. ${i.content}`).join('\n');
      }
      return text;
    }).join('\n');

    return {
      articleNum,
      articleTitle,
      content: content || extractText(article),
      part: context.part,
      chapter: context.chapter,
      section: context.section,
      paragraphs,
    };
  });
}

function walkStructure(node: unknown, context: { part?: string; chapter?: string; section?: string } = {}): ParsedArticle[] {
  if (!node || typeof node !== 'object') return [];
  const obj = node as Record<string, unknown>;
  const results: ParsedArticle[] = [];

  // Direct articles at this level
  if (obj['Article']) {
    results.push(...parseArticles(obj['Article'], context));
  }

  // Parts (編)
  if (obj['Part']) {
    const parts = Array.isArray(obj['Part']) ? obj['Part'] : [obj['Part']];
    for (const part of parts) {
      const partObj = part as Record<string, unknown>;
      const partTitle = extractText(partObj['PartTitle'] ?? '');
      const partNum = String(partObj['@_Num'] ?? '');
      const partCtx = { ...context, part: partNum ? `Part ${partNum}: ${partTitle}` : partTitle };
      results.push(...walkStructure(partObj, partCtx));
    }
  }

  // Chapters (章)
  if (obj['Chapter']) {
    const chapters = Array.isArray(obj['Chapter']) ? obj['Chapter'] : [obj['Chapter']];
    for (const chapter of chapters) {
      const chapterObj = chapter as Record<string, unknown>;
      const chapterTitle = extractText(chapterObj['ChapterTitle'] ?? '');
      const chapterNum = String(chapterObj['@_Num'] ?? '');
      const chapterCtx = { ...context, chapter: chapterNum ? `Chapter ${chapterNum}: ${chapterTitle}` : chapterTitle };
      results.push(...walkStructure(chapterObj, chapterCtx));
    }
  }

  // Sections (節)
  if (obj['Section']) {
    const sections = Array.isArray(obj['Section']) ? obj['Section'] : [obj['Section']];
    for (const section of sections) {
      const sectionObj = section as Record<string, unknown>;
      const sectionTitle = extractText(sectionObj['SectionTitle'] ?? '');
      const sectionNum = String(sectionObj['@_Num'] ?? '');
      const sectionCtx = { ...context, section: sectionNum ? `Section ${sectionNum}: ${sectionTitle}` : sectionTitle };
      results.push(...walkStructure(sectionObj, sectionCtx));
    }
  }

  return results;
}

export function parseLawData(lawId: string, lawNum: string, lawName: string, lawBody: unknown): ParsedLaw {
  const body = lawBody as Record<string, unknown> | null;
  if (!body) {
    return { lawId, lawNum, lawName, articles: [], supplementaryProvisions: [] };
  }

  // Extract preamble if present
  const preamble = body['Preamble'] ? extractText(body['Preamble']) : undefined;

  // Main body articles
  const mainBody = body['MainProvision'] ?? body;
  const articles = walkStructure(mainBody);

  // Supplementary provisions
  let supplementaryProvisions: ParsedArticle[] = [];
  if (body['SupplProvision']) {
    const suppl = body['SupplProvision'];
    const supplArray = Array.isArray(suppl) ? suppl : [suppl];
    for (const s of supplArray) {
      supplementaryProvisions.push(...walkStructure(s as Record<string, unknown>));
    }
  }

  return {
    lawId,
    lawNum,
    lawName,
    preamble,
    articles,
    supplementaryProvisions,
  };
}

export { extractText };
