#!/usr/bin/env tsx
/**
 * Census-driven ingestion for Japan Law MCP.
 *
 * Reads data/census.json and ingests ALL ingestable laws from the e-Gov API.
 * Uses controlled concurrency (3 parallel requests, 500ms stagger) to stay
 * within the API's rate limits while maintaining reasonable throughput.
 *
 * Supports resume: skips laws that already have a seed file (>100 bytes).
 *
 * Usage: npm run ingest
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchLawData } from './lib/fetcher.js';
import { parseLawData } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '../data/seed');
const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

// Conservative concurrency: 3 parallel, 500ms stagger = effective ~6 req/3s
const CONCURRENCY = 3;
const STAGGER_MS = 500;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 5000; // 5s, 10s, 20s exponential backoff

const CATEGORY_TYPE_MAP: Record<number, string> = {
  1: 'statute',
  2: 'cabinet_order',
  3: 'ministerial_ordinance',
  4: 'rule',
};

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
  summary: {
    total_laws: number;
    ingestable: number;
    excluded: number;
  };
  laws: CensusLaw[];
}

function seedFileExists(lawId: string): boolean {
  const filePath = path.join(SEED_DIR, `${lawId}.json`);
  try {
    const stat = fs.statSync(filePath);
    return stat.size > 100;
  } catch {
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ingestOneWithRetry(law: CensusLaw): Promise<{ ok: boolean; provisions: number; error?: string }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const lawData = await fetchLawData(law.law_id);
      const parsed = parseLawData(lawData.lawId, lawData.lawNum, lawData.lawName, lawData.lawBody);

      const docType = CATEGORY_TYPE_MAP[law.category_id] ?? 'statute';

      const seedFile = {
        id: law.law_id,
        type: docType,
        title: parsed.lawName || law.title,
        title_en: null,
        short_name: null,
        law_number: parsed.lawNum || law.law_number,
        status: 'in_force' as const,
        url: `https://laws.e-gov.go.jp/law/${law.law_id}`,
        description: `${law.title} (${parsed.lawNum || law.law_number})`,
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

      const outPath = path.join(SEED_DIR, `${law.law_id}.json`);
      fs.writeFileSync(outPath, JSON.stringify(seedFile, null, 2), 'utf-8');
      return { ok: true, provisions: seedFile.provisions.length };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      // If rate limited (redirect to error page), back off and retry
      if (errMsg.includes('301') || errMsg.includes('302') || errMsg.includes('sorry') || errMsg.includes('Redirect')) {
        if (attempt < MAX_RETRIES) {
          const backoff = RETRY_BASE_MS * Math.pow(2, attempt);
          console.error(`[ingest] Rate limited on ${law.law_id}, retrying in ${backoff / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(backoff);
          continue;
        }
      }

      if (attempt === MAX_RETRIES) {
        return { ok: false, provisions: 0, error: errMsg };
      }

      // Other errors: retry with backoff too
      if (attempt < MAX_RETRIES) {
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt);
        await sleep(backoff);
        continue;
      }
      return { ok: false, provisions: 0, error: errMsg };
    }
  }
  return { ok: false, provisions: 0, error: 'Max retries exceeded' };
}

async function main() {
  // Read census
  if (!fs.existsSync(CENSUS_PATH)) {
    console.error('[ingest] ERROR: data/census.json not found. Run `npx tsx scripts/census.ts` first.');
    process.exit(1);
  }

  const census: CensusFile = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8'));
  const ingestable = census.laws.filter(l => l.classification === 'ingestable');

  console.log(`[ingest] Census: ${census.summary.total_laws} total, ${ingestable.length} ingestable`);

  // Ensure seed directory exists
  fs.mkdirSync(SEED_DIR, { recursive: true });

  // Filter to only those that need ingesting
  const toIngest = ingestable.filter(l => !seedFileExists(l.law_id));
  const skipped = ingestable.length - toIngest.length;

  console.log(`[ingest] Already have: ${skipped}, need to fetch: ${toIngest.length}`);
  console.log(`[ingest] Concurrency: ${CONCURRENCY}, stagger: ${STAGGER_MS}ms`);

  if (toIngest.length === 0) {
    console.log('[ingest] Nothing to do. All laws already ingested.');
    return;
  }

  let completed = 0;
  let errors = 0;
  const errorLog: Array<{ lawId: string; title: string; error: string }> = [];
  const startTime = Date.now();

  // Process with controlled concurrency pool
  const running = new Set<Promise<void>>();

  for (let i = 0; i < toIngest.length; i++) {
    const law = toIngest[i];

    // Stagger launches
    if (i > 0) {
      await sleep(STAGGER_MS);
    }

    const task = (async () => {
      const result = await ingestOneWithRetry(law);
      completed++;

      if (result.ok) {
        // Log progress every 50 laws
        if (completed % 50 === 0 || completed === 1) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = completed / elapsed;
          const remaining = (toIngest.length - completed) / rate;
          console.log(
            `[${skipped + completed}/${ingestable.length}] ` +
            `Ingested: ${law.title} (${result.provisions} provisions) ` +
            `[${rate.toFixed(1)}/s, ~${Math.ceil(remaining / 60)}min left]`
          );
        }
      } else {
        errors++;
        errorLog.push({ lawId: law.law_id, title: law.title, error: result.error ?? 'unknown' });
        if (errors <= 50) {
          console.error(`[ingest] Error: ${law.title} (${law.law_id}): ${result.error}`);
        }
      }
    })();

    running.add(task);
    task.finally(() => running.delete(task));

    // If we're at max concurrency, wait for one to finish
    if (running.size >= CONCURRENCY) {
      await Promise.race(running);
    }
  }

  // Wait for all remaining tasks
  await Promise.all(running);

  const elapsed = (Date.now() - startTime) / 1000;

  console.log(`\n[ingest] Done in ${Math.ceil(elapsed)}s:`);
  console.log(`  Ingested: ${completed - errors}`);
  console.log(`  Skipped (resume): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Rate: ${((completed - errors) / elapsed).toFixed(1)} laws/s`);

  if (errorLog.length > 0) {
    const errorLogPath = path.join(SEED_DIR, '..', 'ingest-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2), 'utf-8');
    console.log(`  Error log: ${errorLogPath}`);
  }

  // Verify completeness (compare against unique law IDs, not total census entries which have duplicates)
  const seedFiles = fs.readdirSync(SEED_DIR).filter(f => f.endsWith('.json'));
  const uniqueIds = new Set(ingestable.map(l => l.law_id));
  console.log(`\n[ingest] Seed directory: ${seedFiles.length} files (${uniqueIds.size} unique law IDs in census)`);
  if (seedFiles.length < uniqueIds.size) {
    console.log(`[ingest] WARNING: ${uniqueIds.size - seedFiles.length} laws still missing. Re-run to resume.`);
  } else {
    console.log(`[ingest] All ${uniqueIds.size} unique ingestable laws have seed files.`);
  }
}

main().catch(err => {
  console.error('[ingest] Fatal error:', err);
  process.exit(1);
});
