/**
 * check_currency — Check if a Japanese statute is current (in force).
 */

import type { Database } from '@ansvar/mcp-sqlite';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface CheckCurrencyInput {
  document_id: string;
  provision_ref?: string;
  as_of_date?: string;
}

export interface CurrencyResult {
  document_id: string;
  title: string;
  title_en: string | null;
  status: string;
  type: string;
  law_number: string | null;
  issued_date: string | null;
  in_force_date: string | null;
  is_current: boolean;
  provision_exists?: boolean;
  warnings: string[];
}

interface DocumentRow {
  id: string;
  title: string;
  title_en: string | null;
  status: string;
  type: string;
  law_number: string | null;
  issued_date: string | null;
  in_force_date: string | null;
}

export async function checkCurrency(
  db: Database,
  input: CheckCurrencyInput
): Promise<ToolResponse<CurrencyResult | null>> {
  if (!input.document_id) {
    throw new Error('document_id is required');
  }

  const doc = db.prepare(`
    SELECT id, title, title_en, status, type, law_number, issued_date, in_force_date
    FROM legal_documents
    WHERE id = ? OR title LIKE ? OR title_en LIKE ? OR short_name LIKE ?
    LIMIT 1
  `).get(input.document_id, `%${input.document_id}%`, `%${input.document_id}%`, `%${input.document_id}%`) as DocumentRow | undefined;

  if (!doc) {
    return {
      results: null,
      _metadata: generateResponseMetadata(db)
    };
  }

  const warnings: string[] = [];
  const isCurrent = doc.status === 'in_force';

  if (doc.status === 'repealed') {
    warnings.push('This statute has been repealed (廃止)');
  }

  if (doc.status === 'amended') {
    warnings.push('This statute has been amended (改正). The database contains the amended version.');
  }

  let provisionExists: boolean | undefined;
  if (input.provision_ref) {
    const provRef = `art-${input.provision_ref}`;
    const prov = db.prepare(
      'SELECT 1 FROM legal_provisions WHERE document_id = ? AND (provision_ref = ? OR section = ? OR provision_ref = ?)'
    ).get(doc.id, provRef, input.provision_ref, input.provision_ref);
    provisionExists = !!prov;

    if (!provisionExists) {
      warnings.push(`Provision "${input.provision_ref}" not found in this document`);
    }
  }

  return {
    results: {
      document_id: doc.id,
      title: doc.title,
      title_en: doc.title_en,
      status: doc.status,
      type: doc.type,
      law_number: doc.law_number,
      issued_date: doc.issued_date,
      in_force_date: doc.in_force_date,
      is_current: isCurrent,
      provision_exists: provisionExists,
      warnings,
    },
    _metadata: generateResponseMetadata(db)
  };
}
