/**
 * list_sources — Returns metadata about data sources, coverage, and freshness.
 */

import type { Database } from '@ansvar/mcp-sqlite';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface ListSourcesResult {
  jurisdiction: string;
  sources: Array<{
    name: string;
    authority: string;
    url: string;
    license: string;
    coverage: string;
    languages: string[];
  }>;
  database: {
    tier: string;
    schema_version: string;
    built_at: string;
    document_count: number;
    provision_count: number;
    eu_document_count: number;
  };
  limitations: string[];
}

function safeCount(db: Database, sql: string): number {
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  } catch {
    return 0;
  }
}

function safeMetaValue(db: Database, key: string): string {
  try {
    const row = db.prepare('SELECT value FROM db_metadata WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function listSources(db: Database): Promise<ToolResponse<ListSourcesResult>> {
  const documentCount = safeCount(db, 'SELECT COUNT(*) as count FROM legal_documents');
  const provisionCount = safeCount(db, 'SELECT COUNT(*) as count FROM legal_provisions');
  const euDocumentCount = safeCount(db, 'SELECT COUNT(*) as count FROM eu_documents');

  return {
    results: {
      jurisdiction: 'Japan (JP)',
      sources: [
        {
          name: 'e-Gov Law Portal (e-Gov法令検索)',
          authority: 'Digital Agency (デジタル庁), Government of Japan',
          url: 'https://laws.e-gov.go.jp',
          license: 'Government Open Data (Japan Open Data)',
          coverage: 'All Japanese statutes (法律), cabinet orders (政令), and ministerial ordinances (省令). Includes APPI, Cybersecurity Basic Act, Companies Act, Telecommunications Business Act, and related legislation.',
          languages: ['ja'],
        },
        {
          name: 'Japanese Law Translation (JLT)',
          authority: 'Ministry of Justice (法務省), Government of Japan',
          url: 'https://www.japaneselawtranslation.go.jp',
          license: 'Government Open Data (Reference Translations)',
          coverage: 'Official English translations of major Japanese laws. Translations are reference only and not legally binding.',
          languages: ['en', 'ja'],
        },
        {
          name: 'EUR-Lex (for EU adequacy cross-references)',
          authority: 'Publications Office of the European Union',
          url: 'https://eur-lex.europa.eu',
          license: 'Commission Decision 2011/833/EU (reuse of EU documents)',
          coverage: 'EU directive and regulation references for APPI-GDPR adequacy decision cross-referencing.',
          languages: ['en'],
        },
      ],
      database: {
        tier: safeMetaValue(db, 'tier'),
        schema_version: safeMetaValue(db, 'schema_version'),
        built_at: safeMetaValue(db, 'built_at'),
        document_count: documentCount,
        provision_count: provisionCount,
        eu_document_count: euDocumentCount,
      },
      limitations: [
        `Covers ${documentCount.toLocaleString()} Japanese statutes (法律). Cabinet orders (政令) and ministerial ordinances (省令) are available in the professional tier.`,
        'English translations are sourced from the Japanese Law Translation portal and may lag behind Japanese text amendments.',
        'The Japanese text is the sole legally authoritative version; English translations are reference only.',
        'EU cross-references focus on APPI-GDPR adequacy decision context.',
        'Court decisions (判例) and legal commentary are not included.',
        'Always verify against official e-Gov Law Portal publications when legal certainty is required.',
      ],
    },
    _metadata: generateResponseMetadata(db),
  };
}
