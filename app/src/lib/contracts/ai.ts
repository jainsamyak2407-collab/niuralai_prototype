import { z } from "zod";

// Emma response schema. Validated on the server before anything reaches the browser.
// Numbers must come from calculation services; policy answers must cite sources.
export const sourceRef = z.object({
  docId: z.string(),
  title: z.string(),
  section: z.string(),
  version: z.string(),
  effectiveDate: z.string(),
  kind: z.enum(["federal_guidance", "nexa_policy", "carrier_demo_config", "estimate", "case_record"]),
});
export const emmaResponse = z.object({
  answer: z.string().max(1500),
  sourceRefs: z.array(sourceRef).max(6),
  proposedFacts: z.array(z.object({ field: z.string(), value: z.string(), source: z.string() })).max(6),
  uncertainFields: z.array(z.string()).max(6),
  proposedActions: z
    .array(
      z.object({
        type: z.enum(["open_page", "ask_hr_review", "explain_more"]),
        label: z.string().max(60),
        href: z.string().max(200).optional(),
      }),
    )
    .max(3),
});
export type EmmaResponse = z.infer<typeof emmaResponse>;
export type SourceRef = z.infer<typeof sourceRef>;

export const emmaRequest = z.object({
  question: z.string().trim().min(2).max(600),
  caseId: z.string().optional(),
  page: z.string().max(200).optional(),
});

/** POST /api/emma → EmmaApiResult */
export interface EmmaApiResult {
  ok: boolean;
  mode: "model" | "fallback";
  model: string | null;
  response: EmmaResponse | null;
  message?: string; // error or fallback note
}

// Evidence extraction schema (model output). Facts are proposals; people confirm them.
export const extraction = z.object({
  readable: z.boolean(),
  documentType: z.string().max(80),
  people: z.array(z.object({ name: z.string().max(80), role: z.string().max(40) })).max(8),
  eventDate: z.string().nullable(),
  coverageEndDate: z.string().nullable(),
  lastWorkday: z.string().nullable(),
  sources: z.array(z.object({ field: z.string(), page: z.number().int().nullable(), quote: z.string().max(160) })).max(10),
  uncertainFields: z.array(z.string()).max(8),
  syntheticLabelPresent: z.boolean(),
});
export type Extraction = z.infer<typeof extraction>;
