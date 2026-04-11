import type { Decision } from "@adaptive/sdk";

// ─── Mode → colour mapping ────────────────────────────────────────────────────

const MODE_COLOR: Record<Decision["mode"], string> = {
  answer: "#1a7f4b",
  clarify: "#9a5b00",
  hybrid: "#1a5fa0",
};

const RISK_COLOR: Record<Decision["risk_level"], string> = {
  low: "#1a7f4b",
  medium: "#9a5b00",
  high: "#c0392b",
};

// ─── Component ───────────────────────────────────────────────────────────────

interface DecisionBannerProps {
  decision: Decision;
}

export function DecisionBanner({ decision }: DecisionBannerProps) {
  const { mode, confidence, ambiguity_level, risk_level } = decision;

  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        padding: "0.75rem 1rem",
        borderRadius: "0.5rem",
        background: "#f0f4f8",
        borderLeft: `4px solid ${MODE_COLOR[mode]}`,
        fontFamily: "inherit",
        fontSize: "0.8rem",
      }}
    >
      <Chip label="mode" value={mode} color={MODE_COLOR[mode]} />
      <Chip label="confidence" value={`${Math.round(confidence * 100)}%`} color="#555" />
      <Chip label="ambiguity" value={ambiguity_level} color="#555" />
      <Chip label="risk" value={risk_level} color={RISK_COLOR[risk_level]} />
    </header>
  );
}

// ─── Chip helper ─────────────────────────────────────────────────────────────

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", gap: "0.25rem", alignItems: "center" }}>
      <span style={{ color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <span
        style={{
          fontWeight: 600,
          color,
          background: `${color}18`,
          padding: "0.15rem 0.45rem",
          borderRadius: "0.25rem",
          textTransform: "capitalize",
        }}
      >
        {value}
      </span>
    </span>
  );
}
