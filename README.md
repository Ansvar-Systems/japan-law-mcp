# Japan Law MCP

[![npm version](https://img.shields.io/npm/v/@ansvar/japan-law-mcp)](https://www.npmjs.com/package/@ansvar/japan-law-mcp)
[![CI](https://github.com/Ansvar-Systems/japan-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/japan-law-mcp/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/Ansvar-Systems/japan-law-mcp/badge)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/japan-law-mcp)

An MCP (Model Context Protocol) server providing full-text search and article-level retrieval of Japanese legislation. Covers the Act on Protection of Personal Information (APPI, 2003, amended 2020/2022), Cybersecurity Basic Act (2014), Telecommunications Business Act, Companies Act (2005), Act on Prohibition of Unauthorized Computer Access, and My Number Act. All data is sourced from the official e-Gov law portal (laws.e-gov.go.jp) maintained by the Digital Agency, with English translations from the Japanese Law Translation portal (japaneselawtranslation.go.jp) maintained by the Ministry of Justice.

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [e-Gov Law Portal](https://laws.e-gov.go.jp) | Digital Agency (Government of Japan) | API | On change | Government Open Data | All Japanese statutes, cabinet orders, ministerial ordinances |
| [Japanese Law Translation (JLT)](https://www.japaneselawtranslation.go.jp) | Ministry of Justice | HTML Scrape | On change | Government Open Data (Reference) | Official English translations of 800+ laws |
| [PPC (個人情報保護委員会)](https://www.ppc.go.jp) | Personal Information Protection Commission | HTML Scrape | On change | Government Public Data | APPI guidelines, enforcement actions, EU adequacy docs |

> Full provenance metadata: [`sources.yml`](./sources.yml)

## Laws Covered

| Law | Japanese Name | Act Number | Key Topic |
|-----|--------------|------------|-----------|
| **Act on Protection of Personal Information (APPI)** | 個人情報の保護に関する法律 | Act No. 57 of 2003 (amended 2020) | Personal data protection (EU adequacy) |
| **Cybersecurity Basic Act** | サイバーセキュリティ基本法 | Act No. 104 of 2014 | National cybersecurity framework |
| **Telecommunications Business Act** | 電気通信事業法 | Act No. 86 of 1984 | Telecom regulation, communications secrecy |
| **Companies Act** | 会社法 | Act No. 86 of 2005 | Corporate governance, shareholder rights |
| **Act on Prohibition of Unauthorized Computer Access** | 不正アクセス行為の禁止等に関する法律 | Act No. 128 of 1999 | Anti-hacking, unauthorized access |
| **My Number Act** | 行政手続における特定の個人を識別するための番号の利用等に関する法律 | Act No. 27 of 2013 | National ID number system |
| **Constitution (selected provisions)** | 日本国憲法 | 1946 | Fundamental rights, Article 13 (privacy basis) |

Additionally includes key PPC guidelines and supplementary materials:

- APPI Guidelines (General Rules, Cross-Border Transfer, etc.)
- PPC Q&A on APPI interpretation
- EU-Japan Adequacy Decision supplementary rules

## Quick Start

### npx (no install)

```bash
npx @ansvar/japan-law-mcp
```

### npm install

```bash
npm install -g @ansvar/japan-law-mcp
japan-law-mcp
```

### Claude Desktop Configuration

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "japan-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/japan-law-mcp"]
    }
  }
}
```

### Cursor Configuration

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "japan-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/japan-law-mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `search_legislation` | Full-text search across all Japanese laws. Supports Japanese and English queries. Returns matching provisions with law name, article number, and relevance score. |
| `get_provision` | Retrieve a specific article/provision by law identifier and article number. Returns full text (Japanese + English where available), citation URL, and metadata. |
| `get_provision_eu_basis` | Cross-reference lookup showing the relationship between Japanese laws and their EU equivalents (e.g., APPI vs GDPR with adequacy context). |
| `validate_citation` | Validate a legal citation against the database. Checks law name, article number, and returns canonical citation format. |
| `check_statute_currency` | Check whether a law or provision is the current version. Returns adoption date, effective date, and amendment history. |
| `list_laws` | List all laws in the database with metadata: official name (Japanese + English), act number, effective date, status, and article count. |

## Deployment Tiers

| Tier | Content | Database Size | Platform |
|------|---------|---------------|----------|
| **Free** | All major statutes + English translations + EU cross-references | ~100-150 MB | Vercel (bundled) or local |
| **Professional** | + Cabinet orders + ministerial ordinances + PPC guidelines + full regulatory corpus | ~500 MB-800 MB | Azure Container Apps / Docker / local |

### Deployment Strategy: MEDIUM - Dual Tier, Bundled Free

The free-tier database containing major statutes and English translations is estimated at 100-150 MB, within the Vercel 250 MB bundle limit. The free-tier database is bundled directly with the Vercel deployment. The professional tier with full cabinet orders, ministerial ordinances, and PPC guidelines requires local Docker or Azure Container Apps deployment.

### Capability Detection

Both tiers use the same codebase. At startup, the server detects available SQLite tables and gates tools accordingly:

```
Free tier:     core_legislation, eu_references, english_translations
Professional:  core_legislation, eu_references, english_translations, cabinet_orders, ministerial_ordinances, ppc_guidelines
```

Tools that require professional capabilities return an upgrade message on the free tier.

## Database Size Estimates

| Component | Estimated Size | Notes |
|-----------|---------------|-------|
| Major statutes (laws / 法律) | ~40-50 MB | ~200 key statutes, full Japanese text |
| English translations (JLT) | ~30-40 MB | Official MOJ translations of major laws |
| EU cross-references | ~5-10 MB | APPI-GDPR adequacy mapping tables |
| FTS5 indexes | ~30-50 MB | Full-text search indexes for Japanese text (ICU tokenization) |
| **Free tier total** | **~100-150 MB** | |
| Cabinet orders (政令) | ~100-200 MB | Government orders implementing statutes |
| Ministerial ordinances (省令) | ~150-250 MB | Ministry-level regulations |
| PPC guidelines | ~20-50 MB | APPI interpretive guidelines |
| **Professional tier total** | **~500 MB-800 MB** | |

## Data Freshness

- **SLO:** 30 days maximum data age
- **Automated checks:** Weekly upstream change detection
- **Drift detection:** Nightly hash verification of 6 stable provisions (Constitution Art. 13, APPI Art. 1, Cybersecurity Basic Act Art. 1, Companies Act Art. 1, Telecom Business Act Art. 1, Unauthorized Access Act Art. 1)
- **Health endpoint:** Returns `status: stale` when data exceeds 30-day SLO

## Language Support

The primary language is **Japanese (ja)**, which is the sole legally binding version. Official English translations are available from the Japanese Law Translation portal (japaneselawtranslation.go.jp), maintained by the Ministry of Justice. These translations are explicitly marked as reference translations and are not legally authoritative.

The search tool supports queries in both Japanese and English, with Japanese queries using ICU-based tokenization for proper morphological analysis.

## Contributing

Contributions are welcome. Please read [SECURITY.md](./SECURITY.md) before submitting issues or pull requests.

For data accuracy issues (wrong text, missing articles, stale provisions), use the [data error report template](https://github.com/Ansvar-Systems/japan-law-mcp/issues/new?template=data-error.md).

## License

Apache-2.0

The law text itself is public domain under Japanese government open data policy. This project's code and database structure are licensed under Apache-2.0.
