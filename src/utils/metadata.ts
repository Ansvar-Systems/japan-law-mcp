/**
 * Response metadata for Japan Law MCP tool responses.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_freshness: string;
  disclaimer: string;
  source_authority: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

const STALENESS_THRESHOLD_DAYS = 30;

export function generateResponseMetadata(
  db?: InstanceType<typeof Database>
): ResponseMetadata {
  let freshness = 'Database freshness unknown';

  if (db) {
    try {
      const row = db.prepare("SELECT value FROM db_metadata WHERE key = 'built_at'").get() as { value: string } | undefined;
      if (row?.value) {
        const builtDate = new Date(row.value);
        const daysSince = Math.floor((Date.now() - builtDate.getTime()) / (1000 * 60 * 60 * 24));
        freshness = daysSince > STALENESS_THRESHOLD_DAYS
          ? `WARNING: Database is ${daysSince} days old. Data may be outdated.`
          : `Database built ${daysSince} day(s) ago.`;
      }
    } catch {
      // Ignore metadata read errors
    }
  }

  return {
    data_freshness: freshness,
    disclaimer:
      'This data is derived from the e-Gov Law Portal (laws.e-gov.go.jp) and Japanese Law Translation (japaneselawtranslation.go.jp). ' +
      'The Japanese text is the sole legally authoritative version. English translations are reference translations published by the Ministry of Justice. ' +
      'Verify against official publications when legal certainty is required.',
    source_authority: 'Digital Agency (デジタル庁) / Ministry of Justice (法務省), Government of Japan',
  };
}
