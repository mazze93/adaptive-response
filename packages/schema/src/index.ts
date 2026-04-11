/**
 * @adaptive/schema
 * Zod validators and inferred types for the AdaptiveResponse contract.
 * This is the single source of truth — SDK and API both import from here.
 */

import { z } from "zod";

// ─── Leaf schemas ────────────────────────────────────────────────────────────

export const DecisionModeSchema = z.enum(["answer", "clarify", "hybrid"]);
export const AmbiguityLevelSchema = z.enum(["low", "medium", "high"]);
export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export const IntentTypeSchema = z.enum([
  "informational",
  "analytical",
  "generative",
  "diagnostic",
  "comparative",
]);

// ─── Composite schemas ───────────────────────────────────────────────────────

export const DecisionSchema = z
  .object({
    mode: DecisionModeSchema,
    confidence: z.number().min(0).max(1),
    ambiguity_level: AmbiguityLevelSchema,
    risk_level: RiskLevelSchema,
  })
  .strict();

export const SectionSchema = z
  .object({
    title: z.string().min(1),
    content: z.string().min(1),
  })
  .strict();

export const AlternativeSchema = z
  .object({
    condition: z.string().min(1),
    approach: z.string().min(1),
  })
  .strict();

export const AnswerSchema = z
  .object({
    tldr: z.string().min(1),
    sections: z.array(SectionSchema).optional(),
    assumptions: z.array(z.string()).optional(),
    alternatives: z.array(AlternativeSchema).optional(),
    risks: z.array(z.string()).optional(),
  })
  .strict();

export const MetaSchema = z
  .object({
    intent_type: IntentTypeSchema,
    complexity_score: z.number().min(0).max(10),
    tokens_estimated: z.number().nonnegative().optional(),
  })
  .strict();

export const AdaptiveResponseSchema = z
  .object({
    decision: DecisionSchema,
    clarifying_questions: z.array(z.string().min(1)).optional(),
    answer: AnswerSchema,
    meta: MetaSchema,
  })
  .strict()
  .superRefine((val, ctx) => {
    const needsClarification = val.decision.mode === "clarify" || val.decision.mode === "hybrid";
    if (
      needsClarification &&
      (!val.clarifying_questions || val.clarifying_questions.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clarifying_questions"],
        message: `clarifying_questions must be a non-empty array when mode is "${val.decision.mode}"`,
      });
    }
  });

// ─── Inferred types ──────────────────────────────────────────────────────────

export type DecisionMode = z.infer<typeof DecisionModeSchema>;
export type AmbiguityLevel = z.infer<typeof AmbiguityLevelSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type IntentType = z.infer<typeof IntentTypeSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type Alternative = z.infer<typeof AlternativeSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type AdaptiveResponse = z.infer<typeof AdaptiveResponseSchema>;

// ─── Validators ──────────────────────────────────────────────────────────────

/**
 * Parse and validate unknown data; throws ZodError on failure.
 */
export function validateAdaptiveResponse(data: unknown): AdaptiveResponse {
  return AdaptiveResponseSchema.parse(data);
}

/**
 * Safe parse — returns { success, data } | { success: false, error }.
 * Never throws.
 */
export function safeValidateAdaptiveResponse(data: unknown) {
  return AdaptiveResponseSchema.safeParse(data);
}
