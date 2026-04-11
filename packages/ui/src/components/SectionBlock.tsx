import type { Section } from "@adaptive/sdk";

interface SectionBlockProps {
  section: Section;
}

export function SectionBlock({ section }: SectionBlockProps) {
  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        borderRadius: "0.5rem",
        border: "1px solid #e2e8f0",
        background: "#ffffff",
      }}
    >
      <h3
        style={{
          margin: "0 0 0.5rem",
          fontSize: "0.9rem",
          fontWeight: 700,
          color: "#0f172a",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {section.title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: "0.95rem",
          lineHeight: 1.7,
          color: "#334155",
          whiteSpace: "pre-wrap",
        }}
      >
        {section.content}
      </p>
    </div>
  );
}
