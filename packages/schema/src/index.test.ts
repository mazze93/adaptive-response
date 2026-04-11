/**
 * @adaptive/schema — unit tests
 *
 * Covers:
 *   - Happy-path validation (answer, clarify, hybrid modes)
 *   - Cross-field enforcement: clarifying_questions required for clarify/hybrid
 *   - Field-level constraint violations (confidence out of range, empty strings, etc.)
 *   - safeValidateAdaptiveResponse never throws
 *   - validateAdaptiveResponse throws on bad input
 */

import { describe, expect, it } from "vitest";
import {
  safeValidateAdaptiveResponse,
  validateAdaptiveResponse,
} from "./index.js";
import type { AdaptiveResponse } from "./index.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeResponse(overrides: Partial<AdaptiveResponse> = {}): AdaptiveResponse {
  return {
    decision: {
      mode: "answer",
      confidence: 0.9,
      ambiguity_level: "low",
      risk_level: "low",
    },
    answer: {
      tldr: "A clear, direct answer.",
      sections: [{ title: "Details", content: "Some detail here." }],
      assumptions: ["The question is well-formed."],
      alternatives: [{ condition: "If X", approach: "Do Y instead." }],
      risks: ["Potential for misunderstanding."],
    },
    meta: {
      intent_type: "informational",
      complexity_score: 3,
      tokens_estimated: 120,
    },
    ...overrides,
  };
}

// ─── Happy paths ──────────────────────────────────────────────────────────────

describe("happy paths", () => {
  it("accepts a valid answer-mode response", () => {
    const result = safeValidateAdaptiveResponse(makeResponse());
    expect(result.success).toBe(true);
  });

  it("accepts a valid clarify-mode response with clarifying_questions", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({
        decision: { mode: "clarify", confidence: 0.4, ambiguity_level: "high", risk_level: "medium" },
        clarifying_questions: ["What timeframe are you asking about?"],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a valid hybrid-mode response with clarifying_questions", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({
        decision: { mode: "hybrid", confidence: 0.65, ambiguity_level: "medium", risk_level: "low" },
        clarifying_questions: ["Which platform?"],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a minimal response (only required fields)", () => {
    const minimal = {
      decision: { mode: "answer", confidence: 0.8, ambiguity_level: "low", risk_level: "low" },
      answer: { tldr: "Minimal answer." },
      meta: { intent_type: "informational", complexity_score: 1 },
    };
    const result = safeValidateAdaptiveResponse(minimal);
    expect(result.success).toBe(true);
  });

  it("accepts tokens_estimated: 0", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({ meta: { intent_type: "informational", complexity_score: 1, tokens_estimated: 0 } }),
    );
    expect(result.success).toBe(true);
  });
});

// ─── Cross-field validation ───────────────────────────────────────────────────

describe("cross-field: clarifying_questions required for clarify/hybrid", () => {
  it("rejects clarify mode with no clarifying_questions", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({
        decision: { mode: "clarify", confidence: 0.4, ambiguity_level: "high", risk_level: "low" },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join("."));
      expect(paths).toContain("clarifying_questions");
    }
  });

  it("rejects clarify mode with empty clarifying_questions array", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({
        decision: { mode: "clarify", confidence: 0.4, ambiguity_level: "high", risk_level: "low" },
        clarifying_questions: [],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects clarifying_questions containing empty strings", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({
        decision: { mode: "clarify", confidence: 0.4, ambiguity_level: "high", risk_level: "low" },
        clarifying_questions: ["Valid question?", ""],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects hybrid mode with no clarifying_questions", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({
        decision: { mode: "hybrid", confidence: 0.65, ambiguity_level: "medium", risk_level: "low" },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("allows answer mode without clarifying_questions", () => {
    const result = safeValidateAdaptiveResponse(makeResponse());
    expect(result.success).toBe(true);
  });
});

// ─── Field-level constraint violations ───────────────────────────────────────

describe("field-level violations", () => {
  it("rejects confidence below 0", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({ decision: { mode: "answer", confidence: -0.1, ambiguity_level: "low", risk_level: "low" } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects confidence above 1", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({ decision: { mode: "answer", confidence: 1.1, ambiguity_level: "low", risk_level: "low" } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects complexity_score above 10", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({ meta: { intent_type: "informational", complexity_score: 11 } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects negative tokens_estimated", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({ meta: { intent_type: "informational", complexity_score: 5, tokens_estimated: -1 } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects empty tldr", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({ answer: { tldr: "" } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects empty section title", () => {
    const result = safeValidateAdaptiveResponse(
      makeResponse({ answer: { tldr: "ok", sections: [{ title: "", content: "content" }] } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level keys (strict mode)", () => {
    const withExtra = { ...makeResponse(), unexpected_field: true };
    const result = safeValidateAdaptiveResponse(withExtra);
    expect(result.success).toBe(false);
  });

  it("rejects invalid mode enum", () => {
    const bad = makeResponse();
    (bad.decision as Record<string, unknown>).mode = "guess";
    const result = safeValidateAdaptiveResponse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects invalid intent_type enum", () => {
    const bad = makeResponse();
    (bad.meta as Record<string, unknown>).intent_type = "speculative";
    const result = safeValidateAdaptiveResponse(bad);
    expect(result.success).toBe(false);
  });
});

// ─── Throwing validator ───────────────────────────────────────────────────────

describe("validateAdaptiveResponse", () => {
  it("returns parsed data on valid input", () => {
    const data = makeResponse();
    const result = validateAdaptiveResponse(data);
    expect(result.answer.tldr).toBe(data.answer.tldr);
    expect(result.decision.mode).toBe("answer");
  });

  it("throws ZodError on invalid input", () => {
    expect(() => validateAdaptiveResponse({ garbage: true })).toThrow();
  });

  it("throws ZodError on cross-field violation", () => {
    const bad = makeResponse({
      decision: { mode: "clarify", confidence: 0.3, ambiguity_level: "high", risk_level: "low" },
    });
    expect(() => validateAdaptiveResponse(bad)).toThrow();
  });
});
