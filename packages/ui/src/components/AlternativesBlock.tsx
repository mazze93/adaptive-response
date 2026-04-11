import type { Alternative } from "@adaptive/sdk";

interface AlternativesBlockProps {
  items: Alternative[];
}

export function AlternativesBlock({ items }: AlternativesBlockProps) {
  return (
    <div
      style={{
        borderRadius: "0.5rem",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "0.6rem 1rem",
          background: "#fafafa",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "0.8rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#64748b",
          }}
        >
          Alternatives
        </h3>
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {items.map((alt, i) => (
          <li
            key={i}
            style={{
              padding: "0.9rem 1rem",
              borderBottom: i < items.length - 1 ? "1px solid #f1f5f9" : "none",
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: "1rem",
              alignItems: "start",
            }}
          >
            {/* Condition column */}
            <span
              style={{
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#7c3aed",
                background: "#f5f3ff",
                padding: "0.2rem 0.5rem",
                borderRadius: "0.25rem",
                alignSelf: "start",
              }}
            >
              {alt.condition}
            </span>
            {/* Approach column */}
            <span
              style={{
                fontSize: "0.9rem",
                lineHeight: 1.6,
                color: "#334155",
              }}
            >
              {alt.approach}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
