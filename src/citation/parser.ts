/**
 * Japanese legal citation parser.
 *
 * Parses citations like:
 *   1. Japanese:  "第十七条 個人情報の保護に関する法律"
 *   2. English:   "Article 17, Act on Protection of Personal Information (Act No. 57 of 2003)"
 *   3. Short:     "Art. 17, APPI"
 *   4. ID-based:  "act-57-2003, art. 17"
 *   5. With paragraph: "Article 17, Paragraph 1" / "第十七条第一項"
 */

import type { ParsedCitation } from '../types/index.js';
import { parseArticleNumber, parseParagraphNumber, parseItemNumber } from '../utils/kanji-numerals.js';

// Japanese format: 第十七条 個人情報の保護に関する法律
// Also handles: 第十七条第一項 個人情報の保護に関する法律
const JAPANESE_CITATION = /^(第.+?条(?:第.+?項)?(?:第.+?号)?)\s*[,、]?\s*(.+)$/;

// English full: "Article 17, Act on Protection of Personal Information (Act No. 57 of 2003)"
const ENGLISH_FULL = /^(?:Article|Art\.?)\s+(\d+)(?:\s*,?\s*(?:Paragraph|Para\.?|Par\.?)\s+(\d+))?(?:\s*,?\s*(?:Item)\s+(\d+))?\s*[,、]\s*(.+?)(?:\s*\(Act\s+No\.\s*(\d+)\s+of\s+(\d{4})\))?$/i;

// Short: "Art. 17, APPI"
const SHORT_CITATION = /^(?:Art\.?|Article)\s+(\d+)(?:\s*,?\s*(?:Para\.?|Paragraph)\s+(\d+))?\s*[,、]\s*(.+?)$/i;

// ID-based: "act-57-2003, art. 17"
const ID_BASED = /^(act-\d+-\d{4})\s*[,、]\s*(?:art\.?|article)\s*\.?\s*(\d+)(?:\s*[,、]\s*(?:para\.?|paragraph)\s*\.?\s*(\d+))?$/i;

// Trailing article: "個人情報の保護に関する法律 第十七条"
const TRAILING_JAPANESE = /^(.+?)\s+(第.+?条(?:第.+?項)?(?:第.+?号)?)$/;

export function parseCitation(citation: string): ParsedCitation {
  const trimmed = citation.trim();

  // Try Japanese format first
  let match = trimmed.match(JAPANESE_CITATION);
  if (match) {
    return parseJapaneseRef(match[1], match[2]);
  }

  // Try trailing Japanese (law name before article)
  match = trimmed.match(TRAILING_JAPANESE);
  if (match) {
    return parseJapaneseRef(match[2], match[1]);
  }

  // Try English full format
  match = trimmed.match(ENGLISH_FULL);
  if (match) {
    return {
      valid: true,
      type: 'statute',
      title_en: match[4].trim(),
      article: match[1],
      paragraph: match[2] || undefined,
      item: match[3] || undefined,
      act_number: match[5] ? parseInt(match[5], 10) : undefined,
      year: match[6] ? parseInt(match[6], 10) : undefined,
    };
  }

  // Try short citation
  match = trimmed.match(SHORT_CITATION);
  if (match) {
    return {
      valid: true,
      type: 'statute',
      title_en: match[3].trim(),
      article: match[1],
      paragraph: match[2] || undefined,
    };
  }

  // Try ID-based
  match = trimmed.match(ID_BASED);
  if (match) {
    const idParts = match[1].match(/act-(\d+)-(\d{4})/);
    return {
      valid: true,
      type: 'statute',
      title: match[1],
      article: match[2],
      paragraph: match[3] || undefined,
      act_number: idParts ? parseInt(idParts[1], 10) : undefined,
      year: idParts ? parseInt(idParts[2], 10) : undefined,
    };
  }

  return {
    valid: false,
    type: 'unknown',
    error: `Could not parse Japanese legal citation: "${trimmed}"`,
  };
}

function parseJapaneseRef(articleRef: string, lawName: string): ParsedCitation {
  let article: string | undefined;
  let paragraph: string | undefined;
  let item: string | undefined;

  // Parse the article part (第N条)
  const articleMatch = articleRef.match(/第(.+?)条/);
  if (articleMatch) {
    article = parseArticleNumber(articleRef);
  }

  // Parse the paragraph part (第N項)
  const paraMatch = articleRef.match(/条(第.+?項)/);
  if (paraMatch) {
    paragraph = parseParagraphNumber(paraMatch[1]);
  }

  // Parse the item part (第N号)
  const itemMatch = articleRef.match(/項?(第.+?号)/);
  if (itemMatch) {
    item = parseItemNumber(itemMatch[1]);
  }

  return {
    valid: true,
    type: 'statute',
    title: lawName.trim(),
    article,
    paragraph,
    item,
  };
}
