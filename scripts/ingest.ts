#!/usr/bin/env tsx
/**
 * Ingest Japanese laws from e-Gov API into seed JSON files.
 *
 * Usage: npm run ingest
 *
 * Fetches law data from the e-Gov API and saves parsed output to data/seed/.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchLawData, fetchLawList, type LawListEntry } from './lib/fetcher.js';
import { parseLawData } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '../data/seed');

// Key laws to ingest (by their e-Gov law IDs)
const KEY_LAWS: Array<{ lawId: string; shortName: string; titleEn: string }> = [
  // Core cybersecurity & data protection
  { lawId: '415AC0000000057', shortName: 'APPI', titleEn: 'Act on Protection of Personal Information' },
  { lawId: '426AC1000000104', shortName: 'Cybersecurity Basic Act', titleEn: 'Cybersecurity Basic Act' },
  { lawId: '411AC0000000128', shortName: 'Unauthorized Access Act', titleEn: 'Act on Prohibition of Unauthorized Computer Access' },
  { lawId: '425AC0000000027', shortName: 'My Number Act', titleEn: 'Act on the Use of Numbers to Identify a Specific Individual in Administrative Procedures' },
  // Telecommunications & electronic commerce
  { lawId: '359AC0000000086', shortName: 'Telecom Business Act', titleEn: 'Telecommunications Business Act' },
  { lawId: '412AC0000000137', shortName: 'e-Signatures Act', titleEn: 'Act on Electronic Signatures and Certification Business' },
  { lawId: '414AC0000000151', shortName: 'Provider Liability Act', titleEn: 'Act on the Limitation of Liability for Damages of Specified Telecommunications Service Providers' },
  // Corporate & financial
  { lawId: '417AC0000000086', shortName: 'Companies Act', titleEn: 'Companies Act' },
  { lawId: '321CONSTITUTION', shortName: 'Constitution', titleEn: 'Constitution of Japan' },
  // Criminal & IT crime
  { lawId: '140AC0000000045', shortName: 'Criminal Code', titleEn: 'Penal Code' },
  { lawId: '323AC0000000131', shortName: 'Criminal Procedure Code', titleEn: 'Code of Criminal Procedure' },
  // Digital government & IT
  { lawId: '414AC0000000103', shortName: 'e-Document Act', titleEn: 'Act on Use of Information and Communications Technology in Administrative Procedures' },
  { lawId: '503AC0000000036', shortName: 'Digital Society Act', titleEn: 'Basic Act on Formation of a Digital Society' },
  // Intellectual property
  { lawId: '334AC0000000121', shortName: 'Copyright Act', titleEn: 'Copyright Act' },
  { lawId: '334AC1000000068', shortName: 'Unfair Competition Prevention', titleEn: 'Unfair Competition Prevention Act' },
  // Consumer & trade
  { lawId: '343AC0000000057', shortName: 'Consumer Contract Act', titleEn: 'Consumer Contract Act' },
  { lawId: '412AC0000000091', shortName: 'e-Commerce Act', titleEn: 'Act on Specified Commercial Transactions' },
];

async function main() {
  // Ensure seed directory exists
  fs.mkdirSync(SEED_DIR, { recursive: true });

  console.log(`[ingest] Ingesting ${KEY_LAWS.length} key laws from e-Gov API`);

  for (const law of KEY_LAWS) {
    try {
      console.log(`[ingest] Fetching ${law.shortName} (${law.lawId})...`);
      const lawData = await fetchLawData(law.lawId);
      const parsed = parseLawData(lawData.lawId, lawData.lawNum, lawData.lawName, lawData.lawBody);

      const seedFile = {
        id: law.lawId,
        type: 'statute' as const,
        title: parsed.lawName,
        title_en: law.titleEn,
        short_name: law.shortName,
        law_number: parsed.lawNum,
        status: 'in_force' as const,
        url: `https://laws.e-gov.go.jp/law/${law.lawId}`,
        description: `${law.titleEn} (${parsed.lawNum})`,
        provisions: parsed.articles.map((art, idx) => ({
          provision_ref: `art-${art.articleNum}`,
          chapter: art.chapter ?? art.part ?? null,
          section: art.articleNum,
          title: art.articleTitle || null,
          content: art.content,
          content_en: null,
          language: 'ja',
          order_index: idx,
        })),
      };

      const outPath = path.join(SEED_DIR, `${law.lawId}.json`);
      fs.writeFileSync(outPath, JSON.stringify(seedFile, null, 2), 'utf-8');
      console.log(`[ingest] Wrote ${seedFile.provisions.length} provisions to ${outPath}`);
    } catch (err) {
      console.error(`[ingest] Error ingesting ${law.shortName}:`, err);
    }
  }

  console.log('[ingest] Done');
}

main().catch(err => {
  console.error('[ingest] Fatal error:', err);
  process.exit(1);
});
