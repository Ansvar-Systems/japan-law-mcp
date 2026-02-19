import type Database from '@ansvar/mcp-sqlite';

export interface AboutContext {
  version: string;
  fingerprint: string;
  dbBuilt: string;
}

export interface AboutResult {
  server: {
    name: string;
    package: string;
    version: string;
    suite: string;
    repository: string;
  };
  dataset: {
    fingerprint: string;
    built: string;
    jurisdiction: string;
    content_basis: string;
    counts: Record<string, number>;
  };
  provenance: {
    sources: string[];
    license: string;
    authenticity_note: string;
  };
  security: {
    access_model: string;
    network_access: boolean;
    filesystem_access: boolean;
    arbitrary_code: boolean;
  };
}

function safeCount(db: InstanceType<typeof Database>, sql: string): number {
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  } catch {
    return 0;
  }
}

export function getAbout(
  db: InstanceType<typeof Database>,
  context: AboutContext
): AboutResult {
  return {
    server: {
      name: 'Japan Law MCP',
      package: '@ansvar/japan-law-mcp',
      version: context.version,
      suite: 'Ansvar Compliance Suite',
      repository: 'https://github.com/Ansvar-Systems/japan-law-mcp',
    },
    dataset: {
      fingerprint: context.fingerprint,
      built: context.dbBuilt,
      jurisdiction: 'Japan (JP)',
      content_basis:
        'Japanese statute text from e-Gov Law Portal (laws.e-gov.go.jp). ' +
        'English translations from Japanese Law Translation (japaneselawtranslation.go.jp). ' +
        'Covers APPI, cybersecurity, data protection, telecommunications, and related legislation.',
      counts: {
        legal_documents: safeCount(db, 'SELECT COUNT(*) as count FROM legal_documents'),
        legal_provisions: safeCount(db, 'SELECT COUNT(*) as count FROM legal_provisions'),
        eu_documents: safeCount(db, 'SELECT COUNT(*) as count FROM eu_documents'),
        eu_references: safeCount(db, 'SELECT COUNT(*) as count FROM eu_references'),
      },
    },
    provenance: {
      sources: [
        'e-Gov Law Portal (laws.e-gov.go.jp) — Digital Agency, Government of Japan',
        'Japanese Law Translation (japaneselawtranslation.go.jp) — Ministry of Justice',
        'Personal Information Protection Commission (ppc.go.jp) — PPC guidelines and enforcement',
      ],
      license: 'Government Open Data (Japan Open Data)',
      authenticity_note:
        'The Japanese text is the sole legally authoritative version. ' +
        'English translations are reference translations published by the Ministry of Justice and are not legally binding.',
    },
    security: {
      access_model: 'Read-only SQLite database with parameterized queries',
      network_access: false,
      filesystem_access: false,
      arbitrary_code: false,
    },
  };
}
