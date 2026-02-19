export interface LegalProvision {
  id: number;
  document_id: string;
  provision_ref: string;
  part?: string;
  chapter?: string;
  section: string;
  title?: string;
  content: string;
  content_en?: string;
  language?: string;
  order_index?: number;
  valid_from?: string;
  valid_to?: string;
}

export interface ProvisionRef {
  document_id: string;
  provision_ref: string;
}
