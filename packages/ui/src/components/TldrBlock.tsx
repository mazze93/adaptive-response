interface TldrBlockProps {
  text: string;
}

export function TldrBlock({ text }: TldrBlockProps) {
  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        borderRadius: "0.5rem",
        background: "#eef6ff",
        borderLeft: "4px solid #3b82f6",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.75rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#3b82f6",
          marginBottom: "0.35rem",
        }}
      >
        TL;DR
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "1rem",
          lineHeight: 1.6,
          color: "#1e293b",
          fontWeight: 500,
        }}
      >
        {text}
      </p>
    </div>
  );
}
