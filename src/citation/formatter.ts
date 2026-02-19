/**
 * Japanese legal citation formatter.
 *
 * Formats:
 *   full:      "Article 17, Act on Protection of Personal Information (Act No. 57 of 2003)"
 *   short:     "Art. 17, APPI"
 *   pinpoint:  "Art. 17(1)"
 *   japanese:  "第十七条 個人情報の保護に関する法律"
 */

import type { ParsedCitation, CitationFormat } from '../types/index.js';
import { formatArticleKanji, arabicToKanji } from '../utils/kanji-numerals.js';

export function formatCitation(
  parsed: ParsedCitation,
  format: CitationFormat = 'full'
): string {
  if (!parsed.valid || !parsed.article) {
    return '';
  }

  const pinpoint = buildPinpoint(parsed, format === 'japanese');

  switch (format) {
    case 'full': {
      const name = parsed.title_en ?? parsed.title ?? '';
      const actInfo = parsed.act_number && parsed.year
        ? ` (Act No. ${parsed.act_number} of ${parsed.year})`
        : '';
      return `Article ${pinpoint}, ${name}${actInfo}`.trim();
    }

    case 'short': {
      const name = parsed.title_en ?? parsed.title ?? '';
      return `Art. ${pinpoint}, ${name}`.trim();
    }

    case 'pinpoint':
      return `Art. ${pinpoint}`;

    case 'japanese': {
      const articleKanji = formatArticleKanji(parsed.article);
      let ref = articleKanji;
      if (parsed.paragraph) {
        const paraNum = parseInt(parsed.paragraph, 10);
        ref += `第${isNaN(paraNum) ? parsed.paragraph : arabicToKanji(paraNum)}項`;
      }
      if (parsed.item) {
        const itemNum = parseInt(parsed.item, 10);
        ref += `第${isNaN(itemNum) ? parsed.item : arabicToKanji(itemNum)}号`;
      }
      const name = parsed.title ?? parsed.title_en ?? '';
      return `${ref} ${name}`.trim();
    }

    default:
      return `Article ${pinpoint}, ${parsed.title_en ?? parsed.title ?? ''}`.trim();
  }
}

function buildPinpoint(parsed: ParsedCitation, isJapanese: boolean = false): string {
  let ref = parsed.article ?? '';
  if (!isJapanese) {
    if (parsed.paragraph) {
      ref += `(${parsed.paragraph})`;
    }
    if (parsed.item) {
      ref += `(${parsed.item})`;
    }
  }
  return ref;
}
