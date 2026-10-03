/**
 * rust-tutorial backend — a thin, cached, rate-limited proxy in front of the
 * official Rust Playground so the static tutorial site on GitHub Pages can
 * compile and run real Rust from the browser (play.rust-lang.org sends no CORS
 * headers, so the browser cannot call it directly).
 *
 * Routes:
 *   POST /api/run     -> playground /execute
 *   POST /api/format  -> playground /format   (rustfmt)
 *   POST /api/clippy  -> playground /clippy
 *   GET  /api/health
 */

const PLAYGROUND = "https://play.rust-lang.org";
const UPSTREAM_TIMEOUT_MS = 30_000;

// Identify ourselves to the playground rather than masquerading as a browser.
const USER_AGENT =
  "rust-tutorial/1.0 (+https://github.com/havban/rust-tutorial) via cloudflare-workers";

const MAX_CODE_BYTES = 50_000;
const CACHE_TTL_SECONDS = 3600;

// Per-isolate sliding window. Not a global guarantee (each colo/isolate keeps
// its own counters) but enough to stop a single tab hammering upstream.
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 40 };
const hits = new Map();

const ALLOWED_ORIGINS = [
  /^https:\/\/havban\.github\.io$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/\[::1\](:\d+)?$/,
];

const CHANNELS = new Set(["stable", "beta", "nightly"]);
const MODES = new Set(["debug", "release"]);
const EDITIONS = new Set(["2015", "2018", "2021", "2024"]);
const CRATE_TYPES = new Set(["bin", "lib"]);

function corsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGINS.some((re) => re.test(origin));
  const headers = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  // Unknown origins still get a usable response for curl/devtools, just not
  // credentialed browser access to a named origin.
  headers["Access-Control-Allow-Origin"] = allowed ? origin : "*";
  return headers;
}

function json(body, { status = 200, origin, extra = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
      ...extra,
    },
  });
}

function rateLimited(ip) {
  const now = Date.now();
  const window = (hits.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT.windowMs,
  );
  if (window.length >= RATE_LIMIT.maxRequests) {
    hits.set(ip, window);
    return Math.ceil((RATE_LIMIT.windowMs - (now - window[0])) / 1000);
  }
  window.push(now);
  hits.set(ip, window);
  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 5000) {
    for (const [key, stamps] of hits) {
      if (!stamps.some((t) => now - t < RATE_LIMIT.windowMs)) hits.delete(key);
    }
  }
  return 0;
}

/** Whitelist + clamp whatever the browser sent; never forward raw input. */
function buildPayload(route, input) {
  const code = typeof input.code === "string" ? input.code : "";
  if (!code.trim()) throw new HttpError(400, "No code was submitted.");
  if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) {
    throw new HttpError(413, `Code must be under ${MAX_CODE_BYTES} bytes.`);
  }

  const edition = EDITIONS.has(String(input.edition))
    ? String(input.edition)
    : "2021";

  if (route === "format") return { code, edition };

  const tests = input.tests === true;
  return {
    code,
    edition,
    tests,
    channel: CHANNELS.has(input.channel) ? input.channel : "stable",
    mode: MODES.has(input.mode) ? input.mode : "debug",
    // Test runs must compile as a lib, otherwise the playground wants a main().
    crateType: CRATE_TYPES.has(input.crateType)
      ? input.crateType
      : tests
        ? "lib"
        : "bin",
    backtrace: false,
  };
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function cacheKeyFor(route, payload) {
  const body = JSON.stringify(payload);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(body),
  );
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return new Request(`https://cache.rust-tutorial.invalid/${route}/${hex}`);
}

async function callPlayground(route, payload) {
  const upstreamPath = { run: "/execute", format: "/format", clippy: "/clippy" }[
    route
  ];

  let upstream;
  try {
    upstream = await fetch(PLAYGROUND + upstreamPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    throw new HttpError(
      504,
      timedOut
        ? "The compiler took too long to answer. Try again, or simplify the program."
        : `Could not reach the Rust Playground: ${err.message}`,
    );
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    throw new HttpError(
      upstream.status === 429 ? 429 : 502,
      upstream.status === 429
        ? "The Rust Playground is rate-limiting us. Wait a few seconds and retry."
        : `Rust Playground returned HTTP ${upstream.status}: ${text.slice(0, 300)}`,
    );
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(502, "Rust Playground returned a non-JSON response.");
  }

  // /execute and /clippy disagree on the casing of this one field.
  return {
    success: data.success !== false,
    stdout: data.stdout ?? "",
    stderr: data.stderr ?? "",
    code: data.code,
    exitDetail: data.exitDetail ?? data.exit_detail ?? null,
    error: data.error ?? null,
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const route = url.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/api/health" || url.pathname === "/") {
      return json(
        {
          ok: true,
          service: "rust-tutorial-api",
          routes: ["/api/run", "/api/format", "/api/clippy", "/api/health"],
          upstream: PLAYGROUND,
        },
        { origin },
      );
    }

    if (!["run", "format", "clippy"].includes(route)) {
      return json({ error: `Unknown route ${url.pathname}` }, { status: 404, origin });
    }

    if (request.method !== "POST") {
      return json({ error: "Use POST." }, { status: 405, origin });
    }

    try {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const retryAfter = rateLimited(ip);
      if (retryAfter) {
        return json(
          {
            error: `Too many runs — slow down for ${retryAfter}s. (The free Rust Playground is a shared resource.)`,
          },
          { status: 429, origin, extra: { "Retry-After": String(retryAfter) } },
        );
      }

      let input;
      try {
        input = await request.json();
      } catch {
        throw new HttpError(400, "Body must be JSON.");
      }

      const payload = buildPayload(route, input);
      const cacheKey = await cacheKeyFor(route, payload);
      const cache = caches.default;

      const cached = await cache.match(cacheKey);
      if (cached) {
        const body = await cached.json();
        return json({ ...body, cached: true }, { origin });
      }

      const result = await callPlayground(route, payload);

      // Cache deterministic-looking successes only; a failed compile is cheap
      // to reproduce and a flaky network error should never be remembered.
      if (result.success) {
        ctx.waitUntil(
          cache.put(
            cacheKey,
            new Response(JSON.stringify(result), {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": `max-age=${CACHE_TTL_SECONDS}`,
              },
            }),
          ),
        );
      }

      return json({ ...result, cached: false }, { origin });
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message }, { status: err.status, origin });
      }
      return json(
        { error: `Unexpected worker error: ${err.message}` },
        { status: 500, origin },
      );
    }
  },
};
