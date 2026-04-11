interface ListBlockProps {
  title: string;
  items: string[];
  /** Accent colour for the left border and bullet. Defaults to #64748b. */
  accentColor?: string;
}

export function ListBlock({ title, items, accentColor = "#64748b" }: ListBlockProps) {
  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        borderRadius: "0.5rem",
        border: "1px solid #e2e8f0",
        borderLeft: `4px solid ${accentColor}`,
        background: "#f8fafc",
      }}
    >
      <h3
        style={{
          margin: "0 0 0.6rem",
          fontSize: "0.8rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: accentColor,
        }}
      >
        {title}
      </h3>
      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
        {items.map((item, i) => (
          <li
            key={item}
            style={{
              fontSize: "0.9rem",
              lineHeight: 1.65,
              color: "#334155",
              paddingBottom: i < items.length - 1 ? "0.3rem" : 0,
            }}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
