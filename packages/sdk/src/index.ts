/**
 * @adaptive/sdk
 * AdaptiveClient — typed fetch wrapper for the /v1/respond API.
 * Re-exports all types from @adaptive/schema for consumer convenience.
 */

export type {
  AdaptiveResponse,
  Alternative,
  AmbiguityLevel,
  Answer,
  Decision,
  DecisionMode,
  IntentType,
  Meta,
  RiskLevel,
  Section,
} from "@adaptive/schema";

export { safeValidateAdaptiveResponse, validateAdaptiveResponse } from "@adaptive/schema";

// ─── Client config ───────────────────────────────────────────────────────────

export interface ClientConfig {
  /** Base URL of the deployed API Worker, e.g. https://adaptive-api.example.workers.dev */
  baseUrl: string;
  /** Optional Bearer token forwarded as Authorization header. */
  apiKey?: string;
  /** Timeout in milliseconds. Defaults to 30 000. */
  timeoutMs?: number;
}

// ─── Request / response shapes ───────────────────────────────────────────────

export interface RespondRequest {
  /** The user's query or prompt. */
  query: string;
  /** Optional system context injected before the query. */
  context?: string;
}

export interface ApiError {
  error: string;
  detail?: string;
}

// ─── Client ──────────────────────────────────────────────────────────────────

import type { AdaptiveResponse } from "@adaptive/schema";
import { validateAdaptiveResponse } from "@adaptive/schema";

export class AdaptiveClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  /**
   * Send a query to the /v1/respond endpoint and return a validated
   * AdaptiveResponse. Throws on HTTP error or schema mismatch.
   */
  async respond(payload: RespondRequest): Promise<AdaptiveResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/respond`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${body}`);
    }

    const raw: unknown = await res.json();

    // Validate at the boundary — throws ZodError on malformed response
    return validateAdaptiveResponse(raw);
  }
}
