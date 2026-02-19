#!/usr/bin/env tsx
/**
 * Database builder for Japan Law MCP server.
 *
 * Builds the SQLite database from seed JSON files in data/seed/.
 *
 * Usage: npm run build:db
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '../data/seed');
const DB_PATH = path.resolve(__dirname, '../data/database.db');

// ─────────────────────────────────────────────────────────────────────────────
// Seed file types
// ─────────────────────────────────────────────────────────────────────────────

interface ProvisionSeed {
  provision_ref: string;
  chapter?: string | null;
  section: string;
  title?: string | null;
  content: string;
  content_en?: string | null;
  language?: string;
  order_index?: number;
}

interface DocumentSeed {
  id: string;
  type: string;
  title: string;
  title_en?: string;
  short_name?: string;
  law_number?: string;
  status: string;
  issued_date?: string;
  in_force_date?: string;
  url?: string;
  description?: string;
  provisions?: ProvisionSeed[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Database schema
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = `
  -- Metadata
  CREATE TABLE IF NOT EXISTS db_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Legal documents (statutes)
  CREATE TABLE IF NOT EXISTS legal_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    title_en TEXT,
    short_name TEXT,
    law_number TEXT,
    type TEXT NOT NULL DEFAULT 'statute',
    status TEXT NOT NULL DEFAULT 'in_force',
    issued_date TEXT,
    in_force_date TEXT,
    url TEXT,
    description TEXT,
    language TEXT DEFAULT 'ja',
    jurisdiction TEXT DEFAULT 'JP',
    source TEXT DEFAULT 'laws.e-gov.go.jp'
  );

  -- Legal provisions (articles)
  CREATE TABLE IF NOT EXISTS legal_provisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL REFERENCES legal_documents(id),
    provision_ref TEXT NOT NULL,
    part TEXT,
    chapter TEXT,
    section TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    content_en TEXT,
    language TEXT DEFAULT 'ja',
    order_index INTEGER DEFAULT 0,
    valid_from TEXT,
    valid_to TEXT
  );

  -- FTS5 index for provisions
  CREATE VIRTUAL TABLE IF NOT EXISTS provisions_fts USING fts5(
    content,
    content='legal_provisions',
    content_rowid='id'
  );

  -- Triggers to keep FTS in sync
  CREATE TRIGGER IF NOT EXISTS provisions_ai AFTER INSERT ON legal_provisions BEGIN
    INSERT INTO provisions_fts(rowid, content) VALUES (new.id, new.content);
  END;
  CREATE TRIGGER IF NOT EXISTS provisions_ad AFTER DELETE ON legal_provisions BEGIN
    INSERT INTO provisions_fts(provisions_fts, rowid, content) VALUES('delete', old.id, old.content);
  END;
  CREATE TRIGGER IF NOT EXISTS provisions_au AFTER UPDATE ON legal_provisions BEGIN
    INSERT INTO provisions_fts(provisions_fts, rowid, content) VALUES('delete', old.id, old.content);
    INSERT INTO provisions_fts(rowid, content) VALUES (new.id, new.content);
  END;

  -- EU documents (for APPI-GDPR adequacy references)
  CREATE TABLE IF NOT EXISTS eu_documents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    year INTEGER NOT NULL,
    number INTEGER NOT NULL,
    community TEXT DEFAULT 'EU',
    celex_number TEXT,
    title TEXT,
    short_name TEXT,
    url_eur_lex TEXT
  );

  -- EU references (cross-references from Japanese law to EU law)
  CREATE TABLE IF NOT EXISTS eu_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL REFERENCES legal_documents(id),
    eu_document_id TEXT NOT NULL REFERENCES eu_documents(id),
    provision_id INTEGER REFERENCES legal_provisions(id),
    reference_type TEXT NOT NULL DEFAULT 'references',
    eu_article TEXT,
    full_citation TEXT,
    reference_context TEXT,
    is_primary_implementation INTEGER DEFAULT 0
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_provisions_document ON legal_provisions(document_id);
  CREATE INDEX IF NOT EXISTS idx_provisions_ref ON legal_provisions(provision_ref);
  CREATE INDEX IF NOT EXISTS idx_provisions_section ON legal_provisions(section);
  CREATE INDEX IF NOT EXISTS idx_eu_references_document ON eu_references(document_id);
  CREATE INDEX IF NOT EXISTS idx_eu_references_eu_doc ON eu_references(eu_document_id);
  CREATE INDEX IF NOT EXISTS idx_eu_references_provision ON eu_references(provision_id);
  CREATE INDEX IF NOT EXISTS idx_documents_title ON legal_documents(title);
  CREATE INDEX IF NOT EXISTS idx_documents_title_en ON legal_documents(title_en);
  CREATE INDEX IF NOT EXISTS idx_documents_short_name ON legal_documents(short_name);
  CREATE INDEX IF NOT EXISTS idx_documents_law_number ON legal_documents(law_number);
`;

// ─────────────────────────────────────────────────────────────────────────────
// Main build logic
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log(`[build-db] Building database at ${DB_PATH}`);

  // Remove old DB if present
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = DELETE'); // Required for WASM/serverless compatibility
  db.pragma('foreign_keys = ON');

  // Create schema
  db.exec(SCHEMA);

  // Insert metadata
  const metaInsert = db.prepare('INSERT INTO db_metadata (key, value) VALUES (?, ?)');
  metaInsert.run('schema_version', '1.0');
  metaInsert.run('tier', 'free');
  metaInsert.run('jurisdiction', 'JP');
  metaInsert.run('built_at', new Date().toISOString());
  metaInsert.run('builder', 'japan-law-mcp build-db');

  // Read and insert seed files
  if (!fs.existsSync(SEED_DIR)) {
    console.log('[build-db] No seed directory found. Creating empty database.');
    db.close();
    return;
  }

  const seedFiles = fs.readdirSync(SEED_DIR).filter(f => f.endsWith('.json'));
  console.log(`[build-db] Found ${seedFiles.length} seed files`);

  const docInsert = db.prepare(`
    INSERT OR REPLACE INTO legal_documents
      (id, title, title_en, short_name, law_number, type, status, issued_date, in_force_date, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const provInsert = db.prepare(`
    INSERT INTO legal_provisions
      (document_id, provision_ref, chapter, section, title, content, content_en, language, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((docs: DocumentSeed[]) => {
    for (const doc of docs) {
      docInsert.run(
        doc.id, doc.title, doc.title_en ?? null, doc.short_name ?? null,
        doc.law_number ?? null, doc.type, doc.status,
        doc.issued_date ?? null, doc.in_force_date ?? null,
        doc.url ?? null, doc.description ?? null
      );

      if (doc.provisions) {
        for (const prov of doc.provisions) {
          provInsert.run(
            doc.id, prov.provision_ref, prov.chapter ?? null,
            prov.section, prov.title ?? null, prov.content,
            prov.content_en ?? null, prov.language ?? 'ja',
            prov.order_index ?? 0
          );
        }
      }
    }
  });

  const docs: DocumentSeed[] = seedFiles.map(f => {
    const content = fs.readFileSync(path.join(SEED_DIR, f), 'utf-8');
    return JSON.parse(content) as DocumentSeed;
  });

  insertAll(docs);

  // Insert EU cross-reference data (GDPR adequacy)
  insertEUReferences(db);

  // Rebuild FTS index
  db.exec("INSERT INTO provisions_fts(provisions_fts) VALUES('rebuild')");

  // Report stats
  const docCount = (db.prepare('SELECT COUNT(*) as count FROM legal_documents').get() as { count: number }).count;
  const provCount = (db.prepare('SELECT COUNT(*) as count FROM legal_provisions').get() as { count: number }).count;
  const euDocCount = (db.prepare('SELECT COUNT(*) as count FROM eu_documents').get() as { count: number }).count;

  console.log(`[build-db] Done: ${docCount} documents, ${provCount} provisions, ${euDocCount} EU documents`);
  db.close();
}

function insertEUReferences(db: Database.Database) {
  // Insert GDPR as an EU document
  db.prepare(`
    INSERT OR REPLACE INTO eu_documents (id, type, year, number, community, celex_number, title, short_name, url_eur_lex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'regulation:2016/679', 'regulation', 2016, 679, 'EU',
    '32016R0679',
    'Regulation (EU) 2016/679 of the European Parliament and of the Council (General Data Protection Regulation)',
    'GDPR',
    'https://eur-lex.europa.eu/eli/reg/2016/679/oj'
  );

  // Insert EU-Japan adequacy decision
  db.prepare(`
    INSERT OR REPLACE INTO eu_documents (id, type, year, number, community, celex_number, title, short_name, url_eur_lex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'decision:2019/419', 'decision', 2019, 419, 'EU',
    '32019D0419',
    'Commission Implementing Decision (EU) 2019/419 pursuant to Regulation (EU) 2016/679 on the adequate protection of personal data by Japan',
    'EU-Japan Adequacy Decision',
    'https://eur-lex.europa.eu/eli/dec_impl/2019/419/oj'
  );

  // Insert NIS Directive
  db.prepare(`
    INSERT OR REPLACE INTO eu_documents (id, type, year, number, community, celex_number, title, short_name, url_eur_lex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'directive:2016/1148', 'directive', 2016, 1148, 'EU',
    '32016L1148',
    'Directive (EU) 2016/1148 concerning measures for a high common level of security of network and information systems (NIS Directive)',
    'NIS Directive',
    'https://eur-lex.europa.eu/eli/dir/2016/1148/oj'
  );

  // Link APPI to GDPR via adequacy decision
  const appiDoc = db.prepare("SELECT id FROM legal_documents WHERE short_name = 'APPI' OR title LIKE '%個人情報%' LIMIT 1").get() as { id: string } | undefined;
  if (appiDoc) {
    db.prepare(`
      INSERT INTO eu_references (document_id, eu_document_id, reference_type, full_citation, reference_context, is_primary_implementation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      appiDoc.id, 'regulation:2016/679', 'adequacy_decision',
      'GDPR (Regulation 2016/679)',
      'Japan received an EU adequacy decision (2019/419) recognizing APPI as providing adequate personal data protection. This enables data flows from the EU to Japan without additional safeguards.',
      1
    );
    db.prepare(`
      INSERT INTO eu_references (document_id, eu_document_id, reference_type, full_citation, reference_context, is_primary_implementation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      appiDoc.id, 'decision:2019/419', 'adequacy_decision',
      'EU-Japan Adequacy Decision (2019/419)',
      'Commission Implementing Decision (EU) 2019/419 establishing that Japan ensures an adequate level of protection of personal data under APPI, as supplemented by the Supplementary Rules.',
      1
    );
  }

  // Link Cybersecurity Basic Act to NIS Directive
  const cyberDoc = db.prepare("SELECT id FROM legal_documents WHERE short_name = 'Cybersecurity Basic Act' OR title LIKE '%サイバーセキュリティ%' LIMIT 1").get() as { id: string } | undefined;
  if (cyberDoc) {
    db.prepare(`
      INSERT INTO eu_references (document_id, eu_document_id, reference_type, full_citation, reference_context, is_primary_implementation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      cyberDoc.id, 'directive:2016/1148', 'references',
      'NIS Directive (2016/1148)',
      'Japan\'s Cybersecurity Basic Act addresses similar concerns to the EU NIS Directive regarding network and information system security, though it is not a direct implementation.',
      0
    );
  }
}

main();
