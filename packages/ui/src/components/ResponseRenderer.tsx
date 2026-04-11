import type { AdaptiveResponse } from "@adaptive/sdk";
import { AlternativesBlock } from "./AlternativesBlock.js";
import { DecisionBanner } from "./DecisionBanner.js";
import { ListBlock } from "./ListBlock.js";
import { SectionBlock } from "./SectionBlock.js";
import { TldrBlock } from "./TldrBlock.js";

// ─── Component ───────────────────────────────────────────────────────────────

interface ResponseRendererProps {
  data: AdaptiveResponse;
  /** Optional className forwarded to the root element. */
  className?: string;
}

/**
 * Top-level renderer. Maps an AdaptiveResponse to its UI tree:
 *
 *   DecisionBanner
 *   ClarifyingQuestions  (when present)
 *   TldrBlock
 *   SectionBlock[]       (when present)
 *   Assumptions          ListBlock
 *   Risks                ListBlock
 *   Alternatives         AlternativesBlock
 */
export function ResponseRenderer({ data, className }: ResponseRendererProps) {
  const { decision, answer, clarifying_questions } = data;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        maxWidth: "780px",
      }}
    >
      {/* Decision metadata strip */}
      <DecisionBanner decision={decision} />

      {/* Clarifying questions — shown in clarify / hybrid modes */}
      {clarifying_questions && clarifying_questions.length > 0 && (
        <ListBlock title="To clarify" items={clarifying_questions} accentColor="#f59e0b" />
      )}

      {/* Summary */}
      <TldrBlock text={answer.tldr} />

      {/* Body sections */}
      {answer.sections?.map((section) => (
        <SectionBlock key={section.title} section={section} />
      ))}

      {/* Assumptions */}
      {answer.assumptions && answer.assumptions.length > 0 && (
        <ListBlock title="Assumptions" items={answer.assumptions} accentColor="#64748b" />
      )}

      {/* Risks */}
      {answer.risks && answer.risks.length > 0 && (
        <ListBlock title="Risks" items={answer.risks} accentColor="#ef4444" />
      )}

      {/* Alternatives */}
      {answer.alternatives && answer.alternatives.length > 0 && (
        <AlternativesBlock items={answer.alternatives} />
      )}
    </div>
  );
}
