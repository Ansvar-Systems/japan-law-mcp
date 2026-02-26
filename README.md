# Japanese Law MCP Server

**The e-Gov alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fjapan-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/japan-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/japan-law-mcp?style=social)](https://github.com/Ansvar-Systems/japan-law-mcp)
[![CI](https://github.com/Ansvar-Systems/japan-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/japan-law-mcp/actions/workflows/ci.yml)
[![Provisions](https://img.shields.io/badge/provisions-215%2C418-blue)]()

Query **8,909 Japanese laws** -- from 個人情報保護法 (APPI) and サイバーセキュリティ基本法 to 会社法, 刑法, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Japanese legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Japanese legal research is scattered across e-Gov (e-Gov法令検索), the Japanese Law Translation portal (japaneselawtranslation.go.jp), PPC guidelines, and commercial databases. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking APPI requirements or cross-border transfer rules
- A **legal tech developer** building tools on Japanese law
- A **researcher** tracing legislative amendments across the full statutory corpus

...you shouldn't need dozens of browser tabs and manual cross-referencing across Japanese-language government portals. Ask Claude. Get the exact provision. With context.

This MCP server makes Japanese law **searchable, cross-referenceable, and AI-readable** -- covering the entire e-Gov corpus of 8,909 laws with 215,418 individual provisions.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://japan-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add japan-law --transport http https://japan-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "japan-law": {
      "type": "url",
      "url": "https://japan-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "japan-law": {
      "type": "http",
      "url": "https://japan-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/japan-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "japan-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/japan-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"What does APPI Article 23 say about third-party provision of personal data?"*
- *"Is the Unauthorized Computer Access Act (不正アクセス禁止法) still in force?"*
- *"Find provisions about 個人情報 in Japanese law"*
- *"Which Japanese laws relate to the GDPR adequacy decision?"*
- *"Search for cybersecurity incident reporting requirements"*
- *"What does the Companies Act say about board of directors' duties?"*
- *"Find all provisions about 特定個人情報 (My Number data) protection"*
- *"Build a legal stance on data breach notification requirements under APPI"*
- *"Validate this citation: 個人情報の保護に関する法律 第23条"*
- *"What EU directives does Japan's data protection framework implement?"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Laws** | 8,909 | Full Japanese statutory corpus from e-Gov |
| **Provisions** | 215,418 | Full-text searchable with FTS5 |
| **Law categories** | 4 | Statutes (法律), cabinet orders (政令), ministerial ordinances (省令), rules (規則) |
| **EU cross-references** | Adequacy-linked | APPI-GDPR adequacy mapping (2019, renewed 2024) |
| **Database size** | 406 MB | Optimized SQLite, portable |
| **Freshness checks** | Weekly | Automated checks against e-Gov API |

**Verified data only** -- every provision is ingested verbatim from the Digital Agency's e-Gov Law API. Zero LLM-generated content.

### Japanese Law Hierarchy

The database reflects the full structural hierarchy of Japanese legislation:

```
編 (Part) > 章 (Chapter) > 節 (Section) > 款 (Subsection) > 条 (Article) > 項 (Paragraph) > 号 (Item)
```

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from the Digital Agency's official e-Gov Law API
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains regulation text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by statute identifier + article/paragraph
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
e-Gov API → XML Parse → SQLite → FTS5 snippet() → MCP response
               ↑                        ↑
        Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search e-Gov by law number or keyword | Search by plain language (Japanese or English) |
| Navigate multi-chapter statutes manually | Get the exact provision with context |
| Manual cross-referencing between laws | `build_legal_stance` aggregates across sources |
| "Is this statute still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find EU basis -- dig through adequacy decisions | `get_eu_basis` -- linked EU references instantly |
| No API integration for AI tools | MCP protocol -- AI-native |

**Traditional:** Search e-Gov → Browse XML/HTML → Navigate chapter tree → Cross-reference with other statutes → Check amendment status → Repeat

**This MCP:** *"What does APPI say about cross-border transfer of personal data to the EU?"* -- Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 215,418 provisions with BM25 ranking. Supports Japanese and English queries via unicode61 tokenizer |
| `get_provision` | Retrieve specific provision by statute identifier + chapter/article |
| `check_currency` | Check if a statute is in force, amended, or repealed |
| `validate_citation` | Validate citation against database (zero-hallucination check) |
| `build_legal_stance` | Aggregate citations from multiple statutes for a legal topic |
| `format_citation` | Format citations per Japanese conventions (full/short/pinpoint) |
| `list_sources` | List all 8,909 available statutes with metadata |
| `about` | Server info, capabilities, and coverage summary |

### EU/International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations linked to a Japanese statute |
| `get_japanese_implementations` | Find Japanese laws implementing a specific EU act |
| `search_eu_implementations` | Search EU documents with Japanese implementation counts |
| `get_provision_eu_basis` | Get EU law references for a specific provision |
| `validate_eu_compliance` | Check implementation status of EU directives in Japanese law |

---

## EU Law Integration

Japan holds a **GDPR adequacy decision** from the European Commission (originally granted January 2019, renewed and strengthened in 2024), recognizing APPI as providing an adequate level of personal data protection. This makes Japan one of a select group of countries with mutual data flow arrangements with the EU.

The EU bridge tools enable cross-referencing between Japanese data protection law and EU requirements:

| Feature | Details |
|---------|---------|
| **Adequacy basis** | EU Commission Decision 2019/C 27/04 (renewed 2024) |
| **Primary mapping** | APPI provisions to GDPR articles |
| **Supplementary rules** | PPC supplementary rules for cross-border transfers |
| **Bi-directional lookup** | Japanese law to EU basis and EU act to Japanese implementations |

---

## Data Sources & Freshness

All content is sourced from authoritative Japanese government databases:

- **[e-Gov Law Portal (e-Gov法令検索)](https://laws.e-gov.go.jp)** -- Official Japanese government legal database, maintained by the Digital Agency (デジタル庁)
- **[e-Gov Law API](https://laws.e-gov.go.jp/apitop/)** -- Structured API for programmatic access to the full statutory corpus

### Automated Freshness Checks (Weekly)

A [weekly GitHub Actions workflow](.github/workflows/check-updates.yml) monitors the e-Gov API for changes:

| Check | Method |
|-------|--------|
| **Statute amendments** | e-Gov API date comparison against all 8,909 laws |
| **New statutes** | Diffed against database census |
| **Repealed/superseded laws** | Status field monitoring |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official Japanese government publications via the e-Gov Law API. However:
> - This is a **research tool**, not a substitute for professional legal counsel (弁護士)
> - **Court case coverage is not included** -- do not rely on this for case law research
> - **Verify critical citations** against primary sources for court filings or regulatory submissions
> - **EU cross-references** reflect the adequacy decision mapping, not full EUR-Lex text
> - Under the **Attorney Act (弁護士法)**, providing specific legal advice in Japan requires qualification as a 弁護士 (bengoshi). This tool provides access to statutory text, not legal opinions.

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/japan-law-mcp
cd japan-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest                    # Ingest laws from e-Gov API
npm run build:db                  # Rebuild SQLite database
npm run check-updates             # Check for amendments against e-Gov
npm run drift:detect              # Detect data drift from upstream
npm run test:contract             # Run contract tests against golden fixtures
```

### Performance

- **Search speed:** <100ms for most FTS5 queries
- **Database size:** 406 MB (full corpus, optimized SQLite)
- **Laws covered:** 8,909 (100% of e-Gov ingestable statutes)
- **Provisions:** 215,418 individually searchable sections

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

### [@ansvar/automotive-cybersecurity-mcp](https://github.com/Ansvar-Systems/Automotive-MCP)
**Query UNECE R155/R156 and ISO 21434** -- Automotive cybersecurity compliance. `npx @ansvar/automotive-cybersecurity-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, China, Denmark, Finland, France, Germany, Ghana, Iceland, India, Ireland, Israel, Italy, Kenya, Netherlands, Nigeria, Norway, Singapore, Slovenia, South Korea, Sweden, Switzerland, Thailand, UAE, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- English translations integration (from japaneselawtranslation.go.jp)
- EU cross-reference expansion (adequacy decision mapping)
- Court case law (裁判例) coverage
- Historical statute versions and amendment tracking
- PPC guidelines and enforcement actions

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{japan_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Japanese Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/japan-law-mcp},
  note = {Full Japanese statutory corpus with 8,909 laws and 215,418 provisions via e-Gov API}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Japanese Government (public domain via [Japan Open Data](https://www.digital.go.jp/policies/open_data))
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool for Japanese law -- turns out everyone building compliance tools has the same research frustrations.

So we're open-sourcing it. Navigating 8,909 statutes across a Japanese-language government portal shouldn't require fluency in legal Japanese.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
