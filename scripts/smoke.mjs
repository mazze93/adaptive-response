#!/usr/bin/env node
/**
 * Adaptive Response smoke test
 *
 * Exercises the full AI → schema validation pipeline without needing
 * the Cloudflare Worker runtime. Uses the same system prompt and
 * validation logic as the Worker.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/smoke.mjs
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/smoke.mjs "your custom query"
 *
 * Optional env vars:
 *   ANTHROPIC_MODEL   — defaults to claude-sonnet-4-6
 */

// ─── Colour helpers ───────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
};
const bold = (s) => `${c.bold}${s}${c.reset}`;
const green = (s) => `${c.green}${s}${c.reset}`;
const red = (s) => `${c.red}${s}${c.reset}`;
const dim = (s) => `${c.dim}${s}${c.reset}`;
const cyan = (s) => `${c.cyan}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;

// ─── Config ───────────────────────────────────────────────────────────────────

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const QUERY = process.argv[2] ?? "What is the capital of France, and what makes it significant?";

if (!API_KEY) {
  console.error(red("✘ ANTHROPIC_API_KEY is not set."));
  console.error(
    dim("  Export it before running: ANTHROPIC_API_KEY=sk-ant-... node scripts/smoke.mjs"),
  );
  process.exit(1);
}

// ─── System prompt (kept in sync with apps/api/src/index.ts) ─────────────────

const SYSTEM_PROMPT = `\
You are an adaptive response engine. Analyse the user's query and respond \
with a single JSON object that strictly matches this TypeScript interface — \
no markdown fences, no prose outside the JSON:

interface AdaptiveResponse {
  decision: {
    mode: "answer" | "clarify" | "hybrid";   // "clarify" when confidence<0.6 OR ambiguity=high; "answer" when confidence≥0.7 AND ambiguity low/medium; "hybrid" otherwise
    confidence: number;                       // 0–1
    ambiguity_level: "low" | "medium" | "high";
    risk_level: "low" | "medium" | "high";
  };
  clarifying_questions?: string[];            // required (non-empty, each item non-empty) when mode is "clarify" or "hybrid"
  answer: {
    tldr: string;                             // always present, 1–2 sentences
    sections?: Array<{ title: string; content: string }>;
    assumptions?: string[];
    alternatives?: Array<{ condition: string; approach: string }>;
    risks?: string[];
  };
  meta: {
    intent_type: "informational" | "analytical" | "generative" | "diagnostic" | "comparative";
    complexity_score: number;                 // 0–10
  };
}`;

// ─── Inline Zod-free schema validation ───────────────────────────────────────
// We validate the key structural invariants without requiring a build step.

function validate(data) {
  const errors = [];

  if (!data || typeof data !== "object") return ["Response is not an object"];

  // decision
  const d = data.decision;
  if (!d) errors.push("missing decision");
  else {
    if (!["answer", "clarify", "hybrid"].includes(d.mode))
      errors.push(`decision.mode invalid: ${d.mode}`);
    if (typeof d.confidence !== "number" || d.confidence < 0 || d.confidence > 1)
      errors.push(`decision.confidence out of range: ${d.confidence}`);
    if (!["low", "medium", "high"].includes(d.ambiguity_level))
      errors.push(`decision.ambiguity_level invalid: ${d.ambiguity_level}`);
    if (!["low", "medium", "high"].includes(d.risk_level))
      errors.push(`decision.risk_level invalid: ${d.risk_level}`);
    // cross-field
    if (
      (d.mode === "clarify" || d.mode === "hybrid") &&
      (!data.clarifying_questions || data.clarifying_questions.length === 0)
    )
      errors.push("clarifying_questions required for clarify/hybrid mode");
    if (data.clarifying_questions?.some((q) => typeof q !== "string" || q.length === 0))
      errors.push("clarifying_questions contains empty strings");
  }

  // answer
  const a = data.answer;
  if (!a) errors.push("missing answer");
  else {
    if (typeof a.tldr !== "string" || a.tldr.length === 0)
      errors.push("answer.tldr missing or empty");
  }

  // meta
  const m = data.meta;
  const validIntents = ["informational", "analytical", "generative", "diagnostic", "comparative"];
  if (!m) errors.push("missing meta");
  else {
    if (!validIntents.includes(m.intent_type))
      errors.push(`meta.intent_type invalid: ${m.intent_type}`);
    if (typeof m.complexity_score !== "number" || m.complexity_score < 0 || m.complexity_score > 10)
      errors.push(`meta.complexity_score out of range: ${m.complexity_score}`);
  }

  return errors;
}

// ─── Render ──────────────────────────────────────────────────────────────────

function render(data, durationMs, inputTokens, outputTokens) {
  const { decision, answer, clarifying_questions, meta } = data;

  const modeColor = { answer: green, clarify: yellow, hybrid: cyan }[decision.mode] ?? ((s) => s);

  console.log();
  console.log(bold("── Decision ─────────────────────────────────────────────────"));
  console.log(`  mode        ${modeColor(bold(decision.mode))}`);
  console.log(`  confidence  ${bold(`${Math.round(decision.confidence * 100)}%`)}`);
  console.log(`  ambiguity   ${decision.ambiguity_level}`);
  console.log(`  risk        ${decision.risk_level}`);

  if (clarifying_questions?.length) {
    console.log();
    console.log(bold("── Clarifying Questions ─────────────────────────────────────"));
    for (let i = 0; i < clarifying_questions.length; i++)
      console.log(`  ${i + 1}. ${clarifying_questions[i]}`);
  }

  console.log();
  console.log(bold("── Answer ───────────────────────────────────────────────────"));
  console.log(`  ${cyan(bold("TL;DR:"))} ${answer.tldr}`);

  if (answer.sections?.length) {
    for (const s of answer.sections) {
      console.log();
      console.log(`  ${bold(s.title)}`);
      // Wrap content at ~72 chars
      const words = s.content.split(" ");
      let line = "  ";
      for (const word of words) {
        if (line.length + word.length > 74) {
          console.log(line);
          line = `  ${word} `;
        } else {
          line += `${word} `;
        }
      }
      if (line.trim()) console.log(line);
    }
  }

  if (answer.assumptions?.length) {
    console.log();
    console.log(dim("  Assumptions:"));
    for (const a of answer.assumptions) console.log(dim(`    · ${a}`));
  }

  if (answer.risks?.length) {
    console.log();
    console.log(`  ${red("Risks:")}`);
    for (const r of answer.risks) console.log(`    · ${r}`);
  }

  if (answer.alternatives?.length) {
    console.log();
    console.log(bold("── Alternatives ─────────────────────────────────────────────"));
    for (const a of answer.alternatives) {
      console.log(`  ${yellow("if")} ${a.condition}`);
      console.log(`    → ${a.approach}`);
    }
  }

  console.log();
  console.log(bold("── Meta ─────────────────────────────────────────────────────"));
  console.log(`  intent       ${meta.intent_type}`);
  console.log(`  complexity   ${meta.complexity_score}/10`);
  console.log(`  tokens       ${inputTokens} in / ${outputTokens} out`);
  console.log(`  duration     ${durationMs}ms`);
  console.log();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log(bold(`Adaptive Response  ·  smoke test`));
  console.log(dim(`model: ${MODEL}`));
  console.log(dim(`query: ${QUERY}`));
  console.log(dim("─".repeat(62)));
  console.log();
  process.stdout.write("Calling Anthropic… ");

  const start = Date.now();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: QUERY }],
    }),
  });

  const durationMs = Date.now() - start;
  process.stdout.write(`${green("done")}  (${durationMs}ms)\n`);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(red(`\n✘ Anthropic error ${res.status}: ${text.slice(0, 300)}`));
    process.exit(1);
  }

  const anthropicData = await res.json();
  const inputTokens = anthropicData.usage?.input_tokens ?? "?";
  const outputTokens = anthropicData.usage?.output_tokens ?? "?";

  const rawText = anthropicData.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // Strip markdown fences (same logic as the Worker)
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error(red("\n✘ Model returned non-JSON:"));
    console.error(dim(rawText.slice(0, 500)));
    process.exit(1);
  }

  process.stdout.write("Validating schema… ");
  const errors = validate(parsed);
  if (errors.length) {
    console.error(red("FAIL"));
    console.error(red("\n✘ Schema validation failed:"));
    for (const e of errors) console.error(`  · ${e}`);
    console.error(dim("\nRaw response:"));
    console.error(dim(JSON.stringify(parsed, null, 2)));
    process.exit(1);
  }
  console.log(green("ok"));

  render(parsed, durationMs, inputTokens, outputTokens);
}

main().catch((err) => {
  console.error(red(`\n✘ Unexpected error: ${err.message}`));
  process.exit(1);
});
