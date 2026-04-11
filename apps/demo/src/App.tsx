/**
 * Demo app — sends a query to /v1/respond (proxied to the local Worker)
 * and renders the result with @adaptive/ui.
 *
 * Includes a static fixture so the UI works without a running API.
 */

import type { AdaptiveResponse } from "@adaptive/sdk";
import { AdaptiveClient } from "@adaptive/sdk";
import { ResponseRenderer } from "@adaptive/ui";
import { useState, useTransition } from "react";

// ─── API client ──────────────────────────────────────────────────────────────
// During `pnpm dev:demo` the Vite proxy forwards /v1 → localhost:8787 (Worker).
// Point VITE_API_URL at a deployed Worker URL for production builds.

const client = new AdaptiveClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "",
});

// ─── Static fixture ──────────────────────────────────────────────────────────
// Rendered immediately so the UI is never blank; replaced on first API call.

const FIXTURE: AdaptiveResponse = {
  decision: {
    mode: "answer",
    confidence: 0.92,
    ambiguity_level: "low",
    risk_level: "low",
  },
  answer: {
    tldr: "This is a fixture response — submit a query above to call the live API.",
    sections: [
      {
        title: "How it works",
        content:
          "Type a query and press ⌘ + Enter. The request goes to the Cloudflare Worker, which calls the Anthropic API with a structured-output prompt. The JSON response is validated against the Zod schema in @adaptive/schema and rendered here.",
      },
    ],
    assumptions: ["The Worker is running on localhost:8787 (or VITE_API_URL is set)."],
    risks: ["API key not configured → 502 from the Worker."],
  },
  meta: {
    intent_type: "informational",
    complexity_score: 2,
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function App() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<AdaptiveResponse>(FIXTURE);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setError(null);
    startTransition(async () => {
      try {
        const result = await client.respond({ query: query.trim() });
        setResponse(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem 1rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
      }}
    >
      {/* Header */}
      <header style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>
          Adaptive Response
        </h1>
        <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
          Schema-driven AI output renderer
        </p>
      </header>

      {/* Query form */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "780px",
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Ask anything… (⌘ + Enter to submit)"
          rows={3}
          style={{
            flex: 1,
            padding: "0.75rem",
            fontSize: "0.95rem",
            border: "1px solid #cbd5e1",
            borderRadius: "0.5rem",
            resize: "vertical",
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={isPending || !query.trim()}
          style={{
            alignSelf: "flex-end",
            padding: "0.65rem 1.25rem",
            background: isPending ? "#94a3b8" : "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: isPending ? "wait" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {isPending ? "Thinking…" : "Send"}
        </button>
      </form>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          style={{
            width: "100%",
            maxWidth: "780px",
            padding: "0.75rem 1rem",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "0.5rem",
            color: "#b91c1c",
            fontSize: "0.875rem",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Response */}
      <ResponseRenderer data={response} />
    </div>
  );
}
