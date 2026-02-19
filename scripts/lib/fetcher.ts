#!/usr/bin/env tsx
/**
 * Fetcher for Japanese law data.
 *
 * Primary source: e-Gov Law Portal API (laws.e-gov.go.jp/api/1/)
 * Secondary source: Japanese Law Translation (japaneselawtranslation.go.jp) — HTML scrape for English
 *
 * The e-Gov API is public and requires no authentication.
 * API documentation: https://laws.e-gov.go.jp/apitop/
 */

import https from 'https';
import { XMLParser } from 'fast-xml-parser';

const E_GOV_API_BASE = 'https://laws.e-gov.go.jp/api/1';
const JLT_BASE = 'https://www.japaneselawtranslation.go.jp';
const USER_AGENT = 'JapanLawMCP/1.0 (https://github.com/Ansvar-Systems/japan-law-mcp)';
const RATE_LIMIT_MS = 500;

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<string> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();

  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { 'User-Agent': USER_AGENT },
    }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        rateLimitedFetch(res.headers.location).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    request.on('error', reject);
  });
}

export interface LawListEntry {
  lawId: string;
  lawNum: string;
  lawNameKana: string;
  lawName: string;
  promulgationDate: string;
}

export interface LawData {
  lawId: string;
  lawNum: string;
  lawName: string;
  lawBody: unknown;
  rawXml: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseAttributeValue: false,
  isArray: (name: string) => {
    const arrayTags = ['Article', 'Paragraph', 'Item', 'Subitem1', 'Chapter', 'Section', 'Part', 'Sentence'];
    return arrayTags.includes(name);
  },
});

/**
 * Fetch list of laws from e-Gov API.
 * Category 1 = all current laws (法律).
 */
export async function fetchLawList(category: number = 1): Promise<LawListEntry[]> {
  const url = `${E_GOV_API_BASE}/lawlists/${category}`;
  console.error(`[fetcher] Fetching law list from ${url}`);
  const xml = await rateLimitedFetch(url);
  const parsed = xmlParser.parse(xml);

  const result = parsed?.DataRoot?.Result;
  if (result?.Code !== '0' && result?.Code !== 0) {
    throw new Error(`e-Gov API error: ${result?.Message ?? 'Unknown error'}`);
  }

  const lawInfos = parsed?.DataRoot?.ApplData?.LawNameListInfo;
  if (!lawInfos) return [];

  const entries = Array.isArray(lawInfos) ? lawInfos : [lawInfos];
  return entries.map((info: Record<string, string>) => ({
    lawId: info.LawId ?? '',
    lawNum: info.LawNo ?? info.LawNum ?? '',
    lawNameKana: info.LawNameKana ?? '',
    lawName: info.LawName ?? '',
    promulgationDate: info.PromulgationDate ?? '',
  }));
}

/**
 * Fetch a specific law's full XML from e-Gov API.
 */
export async function fetchLawData(lawId: string): Promise<LawData> {
  const url = `${E_GOV_API_BASE}/lawdata/${lawId}`;
  console.error(`[fetcher] Fetching law data for ${lawId}`);
  const xml = await rateLimitedFetch(url);
  const parsed = xmlParser.parse(xml);

  const result = parsed?.DataRoot?.Result;
  if (result?.Code !== '0' && result?.Code !== 0) {
    throw new Error(`e-Gov API error for ${lawId}: ${result?.Message ?? 'Unknown error'}`);
  }

  const applData = parsed?.DataRoot?.ApplData;
  const lawFullText = applData?.LawFullText;

  return {
    lawId,
    lawNum: applData?.LawNum ?? '',
    lawName: applData?.LawName ?? lawFullText?.Law?.LawBody?.LawTitle ?? '',
    lawBody: lawFullText?.Law?.LawBody ?? lawFullText?.Law ?? lawFullText,
    rawXml: xml,
  };
}

/**
 * Fetch English translation from JLT (HTML scrape).
 * Returns the HTML body or null if not found.
 */
export async function fetchJLTTranslation(lawName: string): Promise<string | null> {
  try {
    const searchUrl = `${JLT_BASE}/en/laws/search?re=02&ky=${encodeURIComponent(lawName)}&page=1`;
    const html = await rateLimitedFetch(searchUrl);
    // Extract first result link
    const linkMatch = html.match(/href="(\/en\/laws\/detail\/[^"]+)"/);
    if (!linkMatch) return null;

    const detailUrl = `${JLT_BASE}${linkMatch[1]}`;
    const detailHtml = await rateLimitedFetch(detailUrl);
    return detailHtml;
  } catch {
    console.error(`[fetcher] Could not fetch JLT translation for: ${lawName}`);
    return null;
  }
}

export { rateLimitedFetch, E_GOV_API_BASE, JLT_BASE, USER_AGENT };
