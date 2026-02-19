# Japan Law MCP — Project Guide

## Overview
MCP server providing Japanese primary legislation via Model Context Protocol. Data sourced from the e-Gov Law Portal (laws.e-gov.go.jp, Digital Agency) and Japanese Law Translation (japaneselawtranslation.go.jp, Ministry of Justice). Strategy B deployment (runtime DB download on Vercel cold start).

## Architecture
- **Dual transport**: stdio (`src/index.ts`) + Streamable HTTP (`api/mcp.ts`)
- **Shared tool registry**: `src/tools/registry.ts` — both transports use identical tools
- **Database**: SQLite + FTS5, built by `scripts/build-db.ts` from seed JSON
- **Ingestion**: `scripts/ingest.ts` fetches law data from e-Gov API (XML) + JLT (HTML scrape for English)
- **Kanji numerals**: `src/utils/kanji-numerals.ts` handles 第N条 ↔ Article N conversion

## Key Conventions
- All tool implementations return `ToolResponse<T>` with `results` + `_metadata`
- Database queries MUST use parameterized statements (never string interpolation)
- FTS5 queries go through `buildFtsQueryVariants()` for sanitization
- Statute IDs resolved via `resolveExistingStatuteId()` (exact match → law_number → LIKE title)
- Article references accepted in both Kanji (第十七条) and Arabic (17) formats
- Journal mode must be DELETE (not WAL) for WASM/serverless compatibility

## Commands
- `npm test` — run unit + integration tests (vitest)
- `npm run test:contract` — run golden contract tests
- `npm run test:coverage` — coverage report
- `npm run build` — compile TypeScript
- `npm run validate` — full test suite (unit + contract)
- `npm run dev` — stdio server in dev mode
- `npm run ingest` — fetch legislation from e-Gov API
- `npm run build:db` — rebuild SQLite from seed JSON

## Testing
- Unit tests in `tests/` (in-memory test DB)
- Golden contract tests in `__tests__/contract/` driven by `fixtures/golden-tests.json`
- Drift detection via `fixtures/golden-hashes.json`
- Always run `npm run validate` before committing

## File Structure
- `src/tools/*.ts` — one file per MCP tool
- `src/utils/*.ts` — shared utilities (FTS, metadata, statute ID resolution, Kanji numerals)
- `src/citation/*.ts` — citation parsing, formatting, validation (Japanese + English)
- `scripts/` — ingestion pipeline and maintenance scripts
- `scripts/lib/` — fetcher (e-Gov API) and parser (XML → articles)
- `api/` — Vercel serverless functions (health + MCP endpoint)
- `fixtures/` — golden tests and drift hashes

## Japan-Specific Notes
- e-Gov API is public (no auth): `https://laws.e-gov.go.jp/api/1/`
- Japanese law structure: 編(Part) > 章(Chapter) > 節(Section) > 条(Article) > 項(Paragraph) > 号(Item)
- APPI has an EU GDPR adequacy decision (2019, renewed 2024)
- Japanese text is the sole legally authoritative version; English translations are reference only

## Git Workflow
- **Never commit directly to `main`.** Always create a feature branch and open a Pull Request.
- Branch protection requires: verified signatures, PR review, and status checks to pass.
- Use conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, etc.
