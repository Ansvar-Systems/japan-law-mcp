export type CitationFormat = 'full' | 'short' | 'pinpoint' | 'japanese';

export interface ParsedCitation {
  valid: boolean;
  type: 'statute' | 'cabinet_order' | 'ministerial_ordinance' | 'unknown';
  title?: string;
  title_en?: string;
  law_number?: string;
  year?: number;
  act_number?: number;
  article?: string;
  paragraph?: string;
  item?: string;
  error?: string;
}

export interface ValidationResult {
  citation: ParsedCitation;
  document_exists: boolean;
  provision_exists: boolean;
  document_title?: string;
  status?: string;
  warnings: string[];
}
