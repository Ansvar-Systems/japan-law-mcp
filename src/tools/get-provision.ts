/**
 * get_provision — Retrieve a specific provision from a Japanese statute.
 */

import type { Database } from '@ansvar/mcp-sqlite';
import { resolveExistingStatuteId } from '../utils/statute-id.js';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';
import { parseArticleNumber } from '../utils/kanji-numerals.js';

export interface GetProvisionInput {
  document_id: string;
  article?: string;
  provision_ref?: string;
}

export interface ProvisionResult {
  document_id: string;
  document_title: string;
  document_title_en: string | null;
  document_status: string;
  provision_ref: string;
  chapter: string | null;
  section: string;
  title: string | null;
  content: string;
  content_en: string | null;
  language: string | null;
  citation_url: string;
}

interface ProvisionRow {
  document_id: string;
  document_title: string;
  document_title_en: string | null;
  document_status: string;
  document_url: string | null;
  provision_ref: string;
  chapter: string | null;
  section: string;
  title: string | null;
  content: string;
  content_en: string | null;
  language: string | null;
}

/** Safety cap when returning all provisions for a statute */
const MAX_ALL_PROVISIONS = 200;

function buildCitationUrl(row: ProvisionRow): string {
  if (row.document_url) return row.document_url;
  return `https://laws.e-gov.go.jp/law/${row.document_id}`;
}

export async function getProvision(
  db: Database,
  input: GetProvisionInput
): Promise<ToolResponse<ProvisionResult | ProvisionResult[] | { provisions: ProvisionResult[]; truncated: boolean; total: number } | null>> {
  if (!input.document_id) {
    throw new Error('document_id is required');
  }

  const resolvedDocumentId = resolveExistingStatuteId(db, input.document_id) ?? input.document_id;

  let articleRef = input.provision_ref ?? input.article;

  // Normalize Kanji article references to Arabic
  if (articleRef) {
    articleRef = parseArticleNumber(articleRef);
  }

  // If no specific provision, return all provisions for the document (with safety cap)
  if (!articleRef) {
    const countRow = db.prepare(
      'SELECT COUNT(*) as count FROM legal_provisions WHERE document_id = ?'
    ).get(resolvedDocumentId) as { count: number } | undefined;
    const total = countRow?.count ?? 0;

    const rows = db.prepare(`
      SELECT
        lp.document_id,
        ld.title as document_title,
        ld.title_en as document_title_en,
        ld.status as document_status,
        ld.url as document_url,
        lp.provision_ref,
        lp.chapter,
        lp.section,
        lp.title,
        lp.content,
        lp.content_en,
        lp.language
      FROM legal_provisions lp
      JOIN legal_documents ld ON ld.id = lp.document_id
      WHERE lp.document_id = ?
      ORDER BY lp.order_index, lp.id
      LIMIT ?
    `).all(resolvedDocumentId, MAX_ALL_PROVISIONS) as ProvisionRow[];

    const results = rows.map(r => ({ ...r, citation_url: buildCitationUrl(r), document_url: undefined })) as unknown as ProvisionResult[];

    if (total > MAX_ALL_PROVISIONS) {
      return {
        results: {
          provisions: results,
          truncated: true,
          total,
        },
        _metadata: generateResponseMetadata(db),
      };
    }

    return {
      results,
      _metadata: generateResponseMetadata(db)
    };
  }

  const provisionRefSearch = `art-${articleRef}`;
  const row = db.prepare(`
    SELECT
      lp.document_id,
      ld.title as document_title,
      ld.title_en as document_title_en,
      ld.status as document_status,
      ld.url as document_url,
      lp.provision_ref,
      lp.chapter,
      lp.section,
      lp.title,
      lp.content,
      lp.content_en,
      lp.language
    FROM legal_provisions lp
    JOIN legal_documents ld ON ld.id = lp.document_id
    WHERE lp.document_id = ? AND (lp.provision_ref = ? OR lp.section = ? OR lp.provision_ref = ?)
  `).get(resolvedDocumentId, provisionRefSearch, articleRef, articleRef) as ProvisionRow | undefined;

  if (!row) {
    return {
      results: null,
      _metadata: generateResponseMetadata(db)
    };
  }

  return {
    results: { ...row, citation_url: buildCitationUrl(row), document_url: undefined } as unknown as ProvisionResult,
    _metadata: generateResponseMetadata(db)
  };
}
