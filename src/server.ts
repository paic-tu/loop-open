import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getSupabaseEnvStatus, renderSupabaseSetupError } from "./integrations/supabase/client";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function isSupabaseSetupError(error: unknown): (Error & { code?: string; missing?: string[] }) | null {
  if (error instanceof Error) {
    const e = error as Error & { code?: string; cause?: unknown; missing?: string[] };
    if (e.code === "SUPABASE_ENV_MISSING") return e;
    const message = error.message ?? "";
    if (
      message.includes("Missing Supabase") ||
      message.includes("SUPABASE_URL") ||
      message.includes("SUPABASE_PUBLISHABLE_KEY") ||
      message.includes("Connect Supabase in Lovable Cloud")
    ) {
      return { ...e, code: "SUPABASE_ENV_MISSING", missing: e.missing ?? getSupabaseEnvStatus().missing } as Error & { code?: string; missing?: string[] };
    }
    const cause = e.cause as Error | undefined;
    if (cause) return isSupabaseSetupError(cause);
  }
  return null;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";

  // Pre-check: if the environment variables are missing, render our friendly setup page
  // regardless of body content.
  const envStatus = getSupabaseEnvStatus();
  if (envStatus.status !== "ok" && envStatus.missing.length > 0) {
    console.error(consumeLastCapturedError() ?? new Error(`Supabase env missing during SSR: ${envStatus.missing.join(", ")}`));
    return new Response(renderSupabaseSetupError(envStatus.missing), {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8", "retry-after": "30" },
    });
  }

  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      const setupErr = isSupabaseSetupError(error);
      if (setupErr) {
        const missing = setupErr.missing && setupErr.missing.length > 0
          ? setupErr.missing
          : getSupabaseEnvStatus().missing;
        console.error(`[Supabase Setup] Missing env vars during SSR bootstrap: ${missing.join(", ")}`);
        return new Response(renderSupabaseSetupError(missing), {
          status: 503,
          headers: { "content-type": "text/html; charset=utf-8", "retry-after": "30" },
        });
      }
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
