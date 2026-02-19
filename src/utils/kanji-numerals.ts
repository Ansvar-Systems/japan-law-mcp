/**
 * Kanji numeral conversion utilities for Japanese law articles.
 *
 * Japanese law uses Kanji numerals for article references:
 *   第一条 (Article 1), 第二条 (Article 2), 第十七条 (Article 17), etc.
 *
 * This module converts between Kanji numerals and Arabic numerals.
 */

const KANJI_DIGITS: Record<string, number> = {
  '〇': 0, '零': 0,
  '一': 1, '壱': 1,
  '二': 2, '弐': 2,
  '三': 3, '参': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9,
};

const KANJI_MULTIPLIERS: Record<string, number> = {
  '十': 10,
  '百': 100,
  '千': 1000,
};

const ARABIC_TO_KANJI_DIGITS: Record<number, string> = {
  0: '〇',
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '七',
  8: '八',
  9: '九',
};

/**
 * Convert a Kanji numeral string to an Arabic number.
 * E.g., '十七' -> 17, '百二十三' -> 123, '一' -> 1
 */
export function kanjiToArabic(kanji: string): number {
  if (!kanji || kanji.length === 0) return 0;

  // Handle simple digit-by-digit Kanji (e.g., '一〇三' -> 103)
  const allSimpleDigits = [...kanji].every(c => c in KANJI_DIGITS);
  if (allSimpleDigits && kanji.length > 1) {
    // Check if it's positional (no multipliers) — used for years, etc.
    const hasMultiplier = [...kanji].some(c => c in KANJI_MULTIPLIERS);
    if (!hasMultiplier) {
      return parseInt([...kanji].map(c => KANJI_DIGITS[c]).join(''), 10);
    }
  }

  // Single digit
  if (kanji.length === 1 && kanji in KANJI_DIGITS) {
    return KANJI_DIGITS[kanji];
  }

  let result = 0;
  let current = 0;

  for (const char of kanji) {
    if (char in KANJI_DIGITS) {
      current = KANJI_DIGITS[char];
    } else if (char in KANJI_MULTIPLIERS) {
      const multiplier = KANJI_MULTIPLIERS[char];
      if (current === 0) {
        // E.g., '十' alone means 10, '百' alone means 100
        current = 1;
      }
      result += current * multiplier;
      current = 0;
    }
  }

  // Add any trailing digit (e.g., '十七' -> result=10, current=7)
  result += current;

  return result;
}

/**
 * Convert an Arabic number to a Kanji numeral string.
 * E.g., 17 -> '十七', 123 -> '百二十三', 1 -> '一'
 */
export function arabicToKanji(num: number): string {
  if (num < 0) return '';
  if (num === 0) return '〇';
  if (num <= 9) return ARABIC_TO_KANJI_DIGITS[num];

  let result = '';
  let remaining = num;

  // Thousands
  const thousands = Math.floor(remaining / 1000);
  if (thousands > 0) {
    if (thousands > 1) {
      result += ARABIC_TO_KANJI_DIGITS[thousands];
    }
    result += '千';
    remaining %= 1000;
  }

  // Hundreds
  const hundreds = Math.floor(remaining / 100);
  if (hundreds > 0) {
    if (hundreds > 1) {
      result += ARABIC_TO_KANJI_DIGITS[hundreds];
    }
    result += '百';
    remaining %= 100;
  }

  // Tens
  const tens = Math.floor(remaining / 10);
  if (tens > 0) {
    if (tens > 1) {
      result += ARABIC_TO_KANJI_DIGITS[tens];
    }
    result += '十';
    remaining %= 10;
  }

  // Ones
  if (remaining > 0) {
    result += ARABIC_TO_KANJI_DIGITS[remaining];
  }

  return result;
}

/**
 * Parse an article reference that may be in Kanji or Arabic format.
 * Returns the Arabic numeral as a string.
 *
 * Handles: '第十七条' -> '17', '17' -> '17', '第1条' -> '1'
 */
export function parseArticleNumber(ref: string): string {
  const trimmed = ref.trim();

  // Strip 第...条 wrapper if present
  const joMatch = trimmed.match(/^第(.+?)条/);
  if (joMatch) {
    const inner = joMatch[1];
    // Check if the inner part is already Arabic
    if (/^\d+$/.test(inner)) {
      return inner;
    }
    // Convert Kanji to Arabic
    const arabicNum = kanjiToArabic(inner);
    return arabicNum > 0 ? String(arabicNum) : inner;
  }

  // Check if it's already a plain Arabic number
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // Try parsing as pure Kanji numeral
  const arabicNum = kanjiToArabic(trimmed);
  return arabicNum > 0 ? String(arabicNum) : trimmed;
}

/**
 * Format an article number in the Japanese 第N条 format.
 * E.g., '17' -> '第十七条', '1' -> '第一条'
 */
export function formatArticleKanji(articleNum: string | number): string {
  const num = typeof articleNum === 'string' ? parseInt(articleNum, 10) : articleNum;
  if (isNaN(num) || num <= 0) return `第${articleNum}条`;
  return `第${arabicToKanji(num)}条`;
}

/**
 * Parse a paragraph reference (項).
 * Handles: '第一項' -> '1', '1' -> '1'
 */
export function parseParagraphNumber(ref: string): string {
  const trimmed = ref.trim();

  const kouMatch = trimmed.match(/^第(.+?)項/);
  if (kouMatch) {
    const inner = kouMatch[1];
    if (/^\d+$/.test(inner)) return inner;
    const arabicNum = kanjiToArabic(inner);
    return arabicNum > 0 ? String(arabicNum) : inner;
  }

  if (/^\d+$/.test(trimmed)) return trimmed;

  const arabicNum = kanjiToArabic(trimmed);
  return arabicNum > 0 ? String(arabicNum) : trimmed;
}

/**
 * Parse an item reference (号).
 * Handles: '第一号' -> '1', '1' -> '1'
 */
export function parseItemNumber(ref: string): string {
  const trimmed = ref.trim();

  const goMatch = trimmed.match(/^第(.+?)号/);
  if (goMatch) {
    const inner = goMatch[1];
    if (/^\d+$/.test(inner)) return inner;
    const arabicNum = kanjiToArabic(inner);
    return arabicNum > 0 ? String(arabicNum) : inner;
  }

  if (/^\d+$/.test(trimmed)) return trimmed;

  const arabicNum = kanjiToArabic(trimmed);
  return arabicNum > 0 ? String(arabicNum) : trimmed;
}
