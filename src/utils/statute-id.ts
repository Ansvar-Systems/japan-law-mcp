/**
 * Japanese statute identifier handling.
 *
 * Japanese statutes are identified by law number (e.g., "act-57-2003" for Act No. 57 of 2003).
 * They can also be found by Japanese name (個人情報の保護に関する法律) or English name.
 */

import type { Database } from '@ansvar/mcp-sqlite';

export function isValidStatuteId(id: string): boolean {
  return id.length > 0 && id.trim().length > 0;
}

export function statuteIdCandidates(id: string): string[] {
  const trimmed = id.trim().toLowerCase();
  const candidates = new Set<string>();
  candidates.add(trimmed);

  // Also try the original casing (important for Japanese)
  candidates.add(id.trim());

  // Convert spaces/dashes to the other form
  if (trimmed.includes(' ')) {
    candidates.add(trimmed.replace(/\s+/g, '-'));
  }
  if (trimmed.includes('-')) {
    candidates.add(trimmed.replace(/-/g, ' '));
  }

  return [...candidates];
}

export function resolveExistingStatuteId(
  db: Database,
  inputId: string,
): string | null {
  // Try exact match on id first
  const exact = db.prepare(
    "SELECT id FROM legal_documents WHERE id = ? LIMIT 1"
  ).get(inputId) as { id: string } | undefined;

  if (exact) return exact.id;

  // Try exact match on law_number
  const byLawNumber = db.prepare(
    "SELECT id FROM legal_documents WHERE law_number = ? LIMIT 1"
  ).get(inputId) as { id: string } | undefined;

  if (byLawNumber) return byLawNumber.id;

  // Try LIKE match on Japanese title
  const byTitle = db.prepare(
    "SELECT id FROM legal_documents WHERE title LIKE ? LIMIT 1"
  ).get(`%${inputId}%`) as { id: string } | undefined;

  if (byTitle) return byTitle.id;

  // Try LIKE match on English title
  const byTitleEn = db.prepare(
    "SELECT id FROM legal_documents WHERE title_en LIKE ? LIMIT 1"
  ).get(`%${inputId}%`) as { id: string } | undefined;

  if (byTitleEn) return byTitleEn.id;

  // Try LIKE match on short_name
  const byShortName = db.prepare(
    "SELECT id FROM legal_documents WHERE short_name LIKE ? LIMIT 1"
  ).get(`%${inputId}%`) as { id: string } | undefined;

  return byShortName?.id ?? null;
}
