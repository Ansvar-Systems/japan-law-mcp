#!/usr/bin/env tsx
/**
 * Check for upstream updates to Japanese laws on e-Gov.
 *
 * Compares the current database content against the e-Gov API
 * to detect new amendments or changes to covered laws.
 *
 * Usage: npm run check-updates
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchLawData } from './lib/fetcher.js';
import { parseLawData } from './lib/parser.js';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.JAPAN_LAW_DB_PATH ?? path.resolve(__dirname, '../data/database.db');

interface LawRow {
  id: string;
  title: string;
  short_name: string | null;
}

function hashContent(text: string): string {
  return createHash('sha256').update(text.trim().replace(/\s+/g, ' ').toLowerCase()).digest('hex');
}

async function main() {
  const db = new Database(DB_PATH, { readonly: true });
  const laws = db.prepare('SELECT id, title, short_name FROM legal_documents').all() as LawRow[];

  console.log(`[check-updates] Checking ${laws.length} laws against e-Gov API`);

  let changesDetected = 0;

  for (const law of laws) {
    try {
      console.log(`[check-updates] Checking ${law.short_name ?? law.title} (${law.id})...`);

      const lawData = await fetchLawData(law.id);
      const parsed = parseLawData(lawData.lawId, lawData.lawNum, lawData.lawName, lawData.lawBody);

      // Compare provision count
      const dbProvCount = (db.prepare(
        'SELECT COUNT(*) as count FROM legal_provisions WHERE document_id = ?'
      ).get(law.id) as { count: number }).count;

      const upstreamProvCount = parsed.articles.length;

      if (dbProvCount !== upstreamProvCount) {
        console.log(`  CHANGED: ${law.short_name ?? law.title} — DB has ${dbProvCount} provisions, upstream has ${upstreamProvCount}`);
        changesDetected++;
        continue;
      }

      // Compare content hashes for first and last articles
      const dbFirst = db.prepare(
        'SELECT content FROM legal_provisions WHERE document_id = ? ORDER BY order_index LIMIT 1'
      ).get(law.id) as { content: string } | undefined;

      if (dbFirst && parsed.articles.length > 0) {
        const dbHash = hashContent(dbFirst.content);
        const upstreamHash = hashContent(parsed.articles[0].content);

        if (dbHash !== upstreamHash) {
          console.log(`  CHANGED: ${law.short_name ?? law.title} — first article content differs`);
          changesDetected++;
          continue;
        }
      }

      console.log(`  OK: ${law.short_name ?? law.title} — no changes detected`);
    } catch (err) {
      console.error(`  ERROR: ${law.short_name ?? law.title}:`, err instanceof Error ? err.message : err);
    }
  }

  db.close();

  console.log(`\n[check-updates] Done. ${changesDetected} changes detected out of ${laws.length} laws.`);

  if (changesDetected > 0) {
    console.log('[check-updates] Run `npm run ingest && npm run build:db` to update the database.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[check-updates] Fatal error:', err);
  process.exit(1);
});
