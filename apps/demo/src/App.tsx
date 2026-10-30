/**
 * Demo app — sends a query to /v1/respond (proxied to the local Worker)
 * and renders the result with @adaptive-response/ui.
 *
 * Boots with the hand-authored self-referential AdaptiveResponse fixture from
 * @adaptive-response/schema so the UI dogfoods the contract without a live API.
 */

import type { AdaptiveResponse } from "@adaptive-response/sdk";
import { AdaptiveClient, validateAdaptiveResponse } from "@adaptive-response/sdk";
import { ResponseRenderer } from "@adaptive-response/ui";
import { useState, useTransition } from "react";
import selfReferentialFixture from "../../../packages/schema/fixtures/self-referential.json";

// ─── API client ──────────────────────────────────────────────────────────────
// During `pnpm dev:demo` the Vite proxy forwards /v1 → localhost:8787 (Worker).
// Point VITE_API_URL at a deployed Worker URL for production builds.

const client = new AdaptiveClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "",
});

// ─── Static fixture ──────────────────────────────────────────────────────────
// Self-referential AdaptiveResponse — validated at module load so a drifted
// fixture fails the demo boot rather than rendering invalid props.

const FIXTURE: AdaptiveResponse = validateAdaptiveResponse(selfReferentialFixture);

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
