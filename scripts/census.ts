#!/usr/bin/env tsx
/**
 * Census script for Japan Law MCP.
 *
 * Enumerates ALL laws from the e-Gov Law API across all 4 categories:
 *   1 = Statutes (法律)
 *   2 = Cabinet Orders (政令)
 *   3 = Ministerial Ordinances (省令)
 *   4 = Rules (規則)
 *
 * Writes data/census.json in golden standard format.
 *
 * Usage: npx tsx scripts/census.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchLawList, type LawListEntry } from './lib/fetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const CENSUS_PATH = path.join(DATA_DIR, 'census.json');

const CATEGORIES: Array<{ id: number; nameJa: string; nameEn: string }> = [
  { id: 1, nameJa: '法律', nameEn: 'Statutes' },
  { id: 2, nameJa: '政令', nameEn: 'Cabinet Orders' },
  { id: 3, nameJa: '省令', nameEn: 'Ministerial Ordinances' },
  { id: 4, nameJa: '規則', nameEn: 'Rules' },
];

// Patterns indicating repealed (廃止) or expired (失効) laws
const EXCLUDED_PATTERNS = [/廃止/, /失効/];

interface CensusLaw {
  law_id: string;
  title: string;
  law_number: string;
  promulgation_date: string;
  category: string;
  category_id: number;
  classification: 'ingestable' | 'excluded';
  exclusion_reason?: string;
}

interface CensusFile {
  schema_version: string;
  jurisdiction: string;
  jurisdiction_name: string;
  portal: string;
  census_date: string;
  agent: string;
  summary: {
    total_laws: number;
    ingestable: number;
    ocr_needed: number;
    inaccessible: number;
    excluded: number;
    by_category: Array<{
      category: string;
      category_id: number;
      total: number;
      ingestable: number;
      excluded: number;
    }>;
  };
  laws: CensusLaw[];
}

function classifyLaw(entry: LawListEntry): { classification: 'ingestable' | 'excluded'; reason?: string } {
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(entry.lawName)) {
      return { classification: 'excluded', reason: `Name matches exclusion pattern: ${pattern.source}` };
    }
  }
  return { classification: 'ingestable' };
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const allLaws: CensusLaw[] = [];
  const categoryStats: CensusFile['summary']['by_category'] = [];

  for (const cat of CATEGORIES) {
    console.log(`[census] Fetching category ${cat.id}: ${cat.nameEn} (${cat.nameJa})...`);

    // Rate limit: 1 second between API calls
    if (cat.id > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const entries = await fetchLawList(cat.id);
    console.log(`[census]   Found ${entries.length} entries`);

    let catIngestable = 0;
    let catExcluded = 0;

    for (const entry of entries) {
      const { classification, reason } = classifyLaw(entry);

      const law: CensusLaw = {
        law_id: entry.lawId,
        title: entry.lawName,
        law_number: entry.lawNum,
        promulgation_date: entry.promulgationDate,
        category: cat.nameEn,
        category_id: cat.id,
        classification,
      };

      if (reason) {
        law.exclusion_reason = reason;
      }

      allLaws.push(law);

      if (classification === 'ingestable') {
        catIngestable++;
      } else {
        catExcluded++;
      }
    }

    categoryStats.push({
      category: cat.nameEn,
      category_id: cat.id,
      total: entries.length,
      ingestable: catIngestable,
      excluded: catExcluded,
    });

    console.log(`[census]   Ingestable: ${catIngestable}, Excluded: ${catExcluded}`);
  }

  const totalIngestable = allLaws.filter(l => l.classification === 'ingestable').length;
  const totalExcluded = allLaws.filter(l => l.classification === 'excluded').length;

  const census: CensusFile = {
    schema_version: '1.0',
    jurisdiction: 'JP',
    jurisdiction_name: 'Japan',
    portal: 'https://laws.e-gov.go.jp',
    census_date: new Date().toISOString().slice(0, 10),
    agent: 'claude-opus-4-6',
    summary: {
      total_laws: allLaws.length,
      ingestable: totalIngestable,
      ocr_needed: 0,
      inaccessible: 0,
      excluded: totalExcluded,
      by_category: categoryStats,
    },
    laws: allLaws,
  };

  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2), 'utf-8');

  console.log(`\n[census] Census complete:`);
  console.log(`  Total laws: ${allLaws.length}`);
  console.log(`  Ingestable: ${totalIngestable}`);
  console.log(`  Excluded:   ${totalExcluded}`);
  for (const cs of categoryStats) {
    console.log(`  ${cs.category} (${cs.category_id}): ${cs.total} total, ${cs.ingestable} ingestable, ${cs.excluded} excluded`);
  }
  console.log(`\n[census] Written to ${CENSUS_PATH}`);
}

main().catch(err => {
  console.error('[census] Fatal error:', err);
  process.exit(1);
});
