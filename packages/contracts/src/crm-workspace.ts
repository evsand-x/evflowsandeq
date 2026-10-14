import { z } from "zod";

export const crmListQuerySchema = z
  .object({
    q: z.string().trim().max(150).default(""),
    status: z.string().max(40).default("all"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    sort: z.enum(["name", "updated"]).default("updated"),
  })
  .strict();
export type CrmListQuery = z.infer<typeof crmListQuerySchema>;
export type CrmCustomer = {
  id: string;
  code: string;
  name: string;
  primary_address: string | null;
  channel: { name: string } | null;
  rayon: { name: string } | null;
  relationship_stage: string;
  onboarding_state?: string;
  state: string;
};
export type CrmNeed = {
  id: string;
  description: string | null;
  estimated_qty: string | null;
  needed_on: string | null;
  needed_period: string | null;
  notes: string | null;
  product: { id: string; name: string; code: string } | null;
  uom: { id: string; name: string } | null;
};
export type CrmContact = {
  id: string;
  code: string;
  full_name: string;
  nickname: string | null;
  job_title: string | null;
  department: string | null;
  pic_functions: string[];
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  state: string;
  notes: string | null;
  version: number;
  customer: CrmCustomer;
};
export type CrmProspect = {
  id: string;
  code: string;
  source: string | null;
  owner_id: string;
  owner_name: string;
  approach_status: string;
  next_action: string | null;
  next_action_at: string | null;
  notes: string | null;
  version: number;
  contact_ids: string[];
  customer: CrmCustomer;
  needs: CrmNeed[];
};
export type CrmOpportunityLine = {
  id: string;
  source_need_id: string | null;
  description: string | null;
  estimated_qty: string | null;
  notes: string | null;
  product: { id: string; name: string; code: string } | null;
  uom: { id: string; name: string } | null;
};
export type CrmOpportunity = {
  id: string;
  code: string;
  period: string;
  owner_id: string;
  contact_ids: string[];
  state: string;
  version: number;
  notes: string | null;
  customer: CrmCustomer;
  lines: CrmOpportunityLine[];
};
export type CrmPage<T> = { data: T[]; total: number; page: number; page_size: number };
export type CrmSummary = { active: number; follow_up: number; opportunities: null; quotes: null };
export type CrmActivity = {
  id: string;
  kind: string;
  occurred_at: string;
  summary: string;
  outcome: string | null;
  next_action: string | null;
  next_action_at: string | null;
  created_by_id: string;
};
export type CrmAttachment = {
  id: string;
  resource_type: string;
  resource_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: string;
  scan_state: string;
  created_at: string;
};
