#!/usr/bin/env tsx
/**
 * Drift detection for Japan Law MCP.
 *
 * Verifies that 6 stable provisions in the database still match their
 * expected content hashes. Used as a canary for upstream data changes.
 *
 * Usage: npm run drift:detect
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.JAPAN_LAW_DB_PATH ?? path.resolve(__dirname, '../data/database.db');
const HASHES_PATH = path.resolve(__dirname, '../fixtures/golden-hashes.json');

interface HashEntry {
  id: string;
  description: string;
  upstream_url: string;
  selector_hint: string;
  expected_sha256: string;
  expected_snippet: string;
}

interface HashesFile {
  version: string;
  mcp_name: string;
  jurisdiction: string;
  provisions: HashEntry[];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function sha256(text: string): string {
  return createHash('sha256').update(normalizeText(text)).digest('hex');
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[drift-detect] Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  const hashes = JSON.parse(fs.readFileSync(HASHES_PATH, 'utf-8')) as HashesFile;
  const db = new Database(DB_PATH, { readonly: true });

  let drifted = 0;
  let firstRun = false;

  for (const entry of hashes.provisions) {
    // Extract law ID from upstream_url
    const urlMatch = entry.upstream_url.match(/\/law\/(.+)$/);
    const lawId = urlMatch ? urlMatch[1] : '';

    if (!lawId) {
      console.log(`  SKIP: ${entry.id} — could not extract law ID from URL`);
      continue;
    }

    // Find the provision by matching the selector hint against the content
    const provisions = db.prepare(
      'SELECT content FROM legal_provisions WHERE document_id = ? ORDER BY order_index'
    ).all(lawId) as { content: string }[];

    const matchingProv = provisions.find(p => p.content.includes(entry.expected_snippet));

    if (!matchingProv) {
      console.log(`  MISSING: ${entry.id} — ${entry.description}`);
      console.log(`           Expected snippet: "${entry.expected_snippet}"`);
      drifted++;
      continue;
    }

    const currentHash = sha256(matchingProv.content);

    if (entry.expected_sha256 === 'COMPUTE_ON_FIRST_INGEST') {
      console.log(`  INIT: ${entry.id} — hash=${currentHash}`);
      entry.expected_sha256 = currentHash;
      firstRun = true;
      continue;
    }

    if (currentHash !== entry.expected_sha256) {
      console.log(`  DRIFT: ${entry.id} — ${entry.description}`);
      console.log(`         Expected: ${entry.expected_sha256}`);
      console.log(`         Got:      ${currentHash}`);
      drifted++;
    } else {
      console.log(`  OK: ${entry.id} — ${entry.description}`);
    }
  }

  db.close();

  if (firstRun) {
    fs.writeFileSync(HASHES_PATH, JSON.stringify(hashes, null, 2) + '\n', 'utf-8');
    console.log(`\n[drift-detect] First run — hashes written to ${HASHES_PATH}`);
  }

  if (drifted > 0) {
    console.log(`\n[drift-detect] ${drifted} provisions have drifted!`);
    process.exit(1);
  } else {
    console.log(`\n[drift-detect] All provisions match. No drift detected.`);
  }
}

main().catch(err => {
  console.error('[drift-detect] Fatal error:', err);
  process.exit(1);
});
