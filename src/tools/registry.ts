/**
 * Tool registry for Japan Law MCP Server.
 * Shared between stdio (index.ts) and HTTP (api/mcp.ts) entry points.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import Database from '@ansvar/mcp-sqlite';

import { searchLegislation, SearchLegislationInput } from './search-legislation.js';
import { getProvision, GetProvisionInput } from './get-provision.js';
import { listSources } from './list-sources.js';
import { validateCitationTool, ValidateCitationInput } from './validate-citation.js';
import { buildLegalStance, BuildLegalStanceInput } from './build-legal-stance.js';
import { formatCitationTool, FormatCitationInput } from './format-citation.js';
import { checkCurrency, CheckCurrencyInput } from './check-currency.js';
import { getEUBasis, GetEUBasisInput } from './get-eu-basis.js';
import { getJapaneseImplementations, GetJapaneseImplementationsInput } from './get-japanese-implementations.js';
import { searchEUImplementations, SearchEUImplementationsInput } from './search-eu-implementations.js';
import { getProvisionEUBasis, GetProvisionEUBasisInput } from './get-provision-eu-basis.js';
import { validateEUCompliance, ValidateEUComplianceInput } from './validate-eu-compliance.js';
import { getAbout, type AboutContext } from './about.js';
export type { AboutContext } from './about.js';

const ABOUT_TOOL: Tool = {
  name: 'about',
  description:
    'Server metadata, dataset statistics, freshness, and provenance. ' +
    'Call this to verify data coverage, currency, and content basis before relying on results.',
  inputSchema: { type: 'object', properties: {} },
};

export const TOOLS: Tool[] = [
  {
    name: 'search_legislation',
    description:
      'Search Japanese statutes and regulations by keyword. Supports both Japanese (e.g., "個人情報") and English (e.g., "personal information") queries. ' +
      'Returns provision-level results with BM25 relevance ranking. ' +
      'Supports natural language queries and FTS5 syntax (AND, OR, NOT, "phrase", prefix*). ' +
      'Results include: document ID, title (Japanese + English), provision reference, snippet with >>>highlight<<< markers, and relevance score. ' +
      'Use document_id to filter within a single statute. Use status to filter by in_force/amended/repealed. ' +
      'Default limit is 10 (max 50). For broad legal research, prefer build_legal_stance instead.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query in Japanese or English. Supports natural language or FTS5 syntax (AND, OR, NOT, "phrase", prefix*). Examples: "個人情報", "personal information", "サイバーセキュリティ"',
        },
        document_id: {
          type: 'string',
          description: 'Filter to a specific statute by ID (e.g., "act-57-2003"), Japanese title, or English title',
        },
        status: {
          type: 'string',
          enum: ['in_force', 'amended', 'repealed'],
          description: 'Filter by legislative status. Omit to search all statuses.',
        },
        language: {
          type: 'string',
          enum: ['ja', 'en'],
          description: 'Filter by language. Omit to search both Japanese and English text.',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10, max: 50). Lower values save tokens.',
          default: 10,
          minimum: 1,
          maximum: 50,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_provision',
    description:
      'Retrieve the full text of a specific provision (article/条) from a Japanese statute, or all provisions if no article is specified. ' +
      'Japanese articles use 条 notation. Pass article as either Arabic numeral ("17") or Kanji ("第十七条"). ' +
      'Pass document_id as the internal ID (e.g., "act-57-2003"), Japanese title (e.g., "個人情報の保護に関する法律"), ' +
      'or English title (e.g., "Act on Protection of Personal Information"). ' +
      'Returns: document ID, title (Japanese + English), status, provision reference, chapter, content (Japanese + English where available), and citation URL. ' +
      'WARNING: Omitting article/provision_ref returns ALL provisions (capped at 200) for the statute.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Statute identifier (e.g., "act-57-2003"), Japanese title, or English title. Fuzzy title matching is supported.',
        },
        article: {
          type: 'string',
          description: 'Article number in Arabic ("17") or Kanji ("第十七条") format. Matched against provision_ref and section columns.',
        },
        provision_ref: {
          type: 'string',
          description: 'Direct provision reference (e.g., "art-17"). Takes precedence over article if both provided.',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'list_sources',
    description:
      'Returns metadata about all data sources backing this server, including jurisdiction, authoritative source details, ' +
      'database tier, schema version, build date, record counts, and known limitations. ' +
      'Call this first to understand data coverage and freshness before relying on other tools.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'validate_citation',
    description:
      'Validate a Japanese legal citation against the database. Returns whether the cited statute and provision exist. ' +
      'Use this as a zero-hallucination check before presenting legal references to users. ' +
      'Supported formats: "第十七条 個人情報の保護に関する法律", "Article 17, Act on Protection of Personal Information (Act No. 57 of 2003)", "Art. 17, APPI". ' +
      'Returns: valid (boolean), parsed components, formatted citation (English + Japanese), warnings about repealed/amended status.',
    inputSchema: {
      type: 'object',
      properties: {
        citation: {
          type: 'string',
          description: 'Japanese legal citation to validate. Examples: "第十七条 個人情報の保護に関する法律", "Article 17, APPI", "Art. 1, Cybersecurity Basic Act"',
        },
      },
      required: ['citation'],
    },
  },
  {
    name: 'build_legal_stance',
    description:
      'Build a comprehensive set of citations for a legal question by searching across all Japanese statutes simultaneously. ' +
      'Returns aggregated results from legislation search, cross-referenced with EU law where applicable. ' +
      'Best for broad legal research questions like "What Japanese laws govern personal data processing?" ' +
      'Supports Japanese and English queries. For targeted lookups of a known provision, use get_provision instead.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Legal question or topic to research in Japanese or English (e.g., "個人データの処理義務", "personal data processing obligations")',
        },
        document_id: {
          type: 'string',
          description: 'Optionally limit search to one statute by ID or title',
        },
        language: {
          type: 'string',
          enum: ['ja', 'en'],
          description: 'Filter by language. Omit to search both.',
        },
        limit: {
          type: 'number',
          description: 'Max results per category (default: 5, max: 20)',
          default: 5,
          minimum: 1,
          maximum: 20,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'format_citation',
    description:
      'Format a Japanese legal citation per standard conventions. ' +
      'Formats: "full" → "Article 17, Act on Protection of Personal Information (Act No. 57 of 2003)", ' +
      '"short" → "Art. 17, APPI", "pinpoint" → "Art. 17(1)", "japanese" → "第十七条 個人情報の保護に関する法律". ' +
      'Does NOT validate existence — use validate_citation for that.',
    inputSchema: {
      type: 'object',
      properties: {
        citation: {
          type: 'string',
          description: 'Citation string to format (e.g., "第十七条 個人情報の保護に関する法律", "Article 17, APPI")',
        },
        format: {
          type: 'string',
          enum: ['full', 'short', 'pinpoint', 'japanese'],
          description: 'Output format. "full" (default): formal English citation. "short": abbreviated. "pinpoint": article reference only. "japanese": 第N条 format.',
          default: 'full',
        },
      },
      required: ['citation'],
    },
  },
  {
    name: 'check_currency',
    description:
      'Check whether a Japanese statute or provision is currently in force, amended, or repealed. ' +
      'Returns: is_current (boolean), status, dates (issued, in-force), law number, and warnings. ' +
      'Essential before citing legislation — repealed acts (廃止) should not be cited as current law.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Statute identifier (e.g., "act-57-2003"), Japanese title, or English title',
        },
        provision_ref: {
          type: 'string',
          description: 'Optional provision reference to check a specific article (e.g., "17" or "第十七条")',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_eu_basis',
    description:
      'Get EU legal basis (directives, regulations, decisions) for a Japanese statute. Returns all EU instruments ' +
      'that the Japanese statute relates to, including through the Japan-EU GDPR adequacy decision. ' +
      'Primarily relevant for APPI → GDPR adequacy context. ' +
      'Example: APPI → adequacy_decision for GDPR (Regulation 2016/679).',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Japanese statute identifier (e.g., "act-57-2003") or title',
        },
        include_articles: {
          type: 'boolean',
          description: 'Include specific EU article references in the response (default: false)',
          default: false,
        },
        reference_types: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['implements', 'supplements', 'applies', 'references', 'complies_with', 'adequacy_decision', 'cites_article'],
          },
          description: 'Filter by reference type (e.g., ["adequacy_decision"]). Omit to return all types.',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_japanese_implementations',
    description:
      'Find Japanese statutes that implement or relate to a specific EU directive or regulation. ' +
      'Input the EU document ID in "type:year/number" format (e.g., "regulation:2016/679" for GDPR). ' +
      'Returns matching Japanese statutes with relationship type (e.g., adequacy_decision for APPI-GDPR).',
    inputSchema: {
      type: 'object',
      properties: {
        eu_document_id: {
          type: 'string',
          description: 'EU document ID in format "type:year/number" (e.g., "regulation:2016/679" for GDPR)',
        },
        primary_only: {
          type: 'boolean',
          description: 'Return only primary implementing/relating statutes (default: false)',
          default: false,
        },
        in_force_only: {
          type: 'boolean',
          description: 'Return only statutes currently in force (default: false)',
          default: false,
        },
      },
      required: ['eu_document_id'],
    },
  },
  {
    name: 'search_eu_implementations',
    description:
      'Search for EU directives and regulations that have been referenced by Japanese statutes. ' +
      'Search by keyword (e.g., "data protection", "privacy"), filter by type (directive/regulation/decision), ' +
      'or year range. Returns EU documents with counts of Japanese statutes referencing them.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keyword search across EU document titles and short names (e.g., "data protection")',
        },
        type: {
          type: 'string',
          enum: ['directive', 'regulation', 'decision'],
          description: 'Filter by EU document type',
        },
        year_from: { type: 'number', description: 'Filter: EU documents from this year onwards' },
        year_to: { type: 'number', description: 'Filter: EU documents up to this year' },
        has_jp_implementation: {
          type: 'boolean',
          description: 'If true, only return EU documents that have at least one Japanese relating statute',
        },
        limit: {
          type: 'number',
          description: 'Max results (default: 20, max: 100)',
          default: 20,
          minimum: 1,
          maximum: 100,
        },
      },
    },
  },
  {
    name: 'get_provision_eu_basis',
    description:
      'Get EU legal basis for a specific provision within a Japanese statute, with article-level precision. ' +
      'Example: APPI Article 24 → references GDPR cross-border transfer provisions. ' +
      'Use this for pinpoint EU adequacy checks at the provision level.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Japanese statute identifier (e.g., "act-57-2003") or title',
        },
        provision_ref: {
          type: 'string',
          description: 'Provision reference (e.g., "24", "第二十四条", "art-24")',
        },
      },
      required: ['document_id', 'provision_ref'],
    },
  },
  {
    name: 'validate_eu_compliance',
    description:
      'Check EU compliance/adequacy status for a Japanese statute or provision. Detects references to EU directives, ' +
      'adequacy decision links, and missing references. Returns compliance status: compliant, partial, unclear, or not_applicable. ' +
      'Particularly relevant for APPI-GDPR adequacy validation.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Japanese statute identifier (e.g., "act-57-2003") or title',
        },
        provision_ref: {
          type: 'string',
          description: 'Optional: check a specific provision (e.g., "24")',
        },
        eu_document_id: {
          type: 'string',
          description: 'Optional: check compliance with a specific EU document (e.g., "regulation:2016/679")',
        },
      },
      required: ['document_id'],
    },
  },
];

export function buildTools(context?: AboutContext): Tool[] {
  return context ? [...TOOLS, ABOUT_TOOL] : TOOLS;
}

export function registerTools(
  server: Server,
  db: InstanceType<typeof Database>,
  context?: AboutContext,
): void {
  const allTools = buildTools(context);

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: allTools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case 'search_legislation':
          result = await searchLegislation(db, args as unknown as SearchLegislationInput);
          break;
        case 'get_provision':
          result = await getProvision(db, args as unknown as GetProvisionInput);
          break;
        case 'list_sources':
          result = await listSources(db);
          break;
        case 'validate_citation':
          result = await validateCitationTool(db, args as unknown as ValidateCitationInput);
          break;
        case 'build_legal_stance':
          result = await buildLegalStance(db, args as unknown as BuildLegalStanceInput);
          break;
        case 'format_citation':
          result = await formatCitationTool(args as unknown as FormatCitationInput);
          break;
        case 'check_currency':
          result = await checkCurrency(db, args as unknown as CheckCurrencyInput);
          break;
        case 'get_eu_basis':
          result = await getEUBasis(db, args as unknown as GetEUBasisInput);
          break;
        case 'get_japanese_implementations':
          result = await getJapaneseImplementations(db, args as unknown as GetJapaneseImplementationsInput);
          break;
        case 'search_eu_implementations':
          result = await searchEUImplementations(db, args as unknown as SearchEUImplementationsInput);
          break;
        case 'get_provision_eu_basis':
          result = await getProvisionEUBasis(db, args as unknown as GetProvisionEUBasisInput);
          break;
        case 'validate_eu_compliance':
          result = await validateEUCompliance(db, args as unknown as ValidateEUComplianceInput);
          break;
        case 'about':
          if (context) {
            result = getAbout(db, context);
          } else {
            return {
              content: [{ type: 'text', text: 'About tool not configured.' }],
              isError: true,
            };
          }
          break;
        default:
          return {
            content: [{ type: 'text', text: `Error: Unknown tool "${name}".` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });
}
