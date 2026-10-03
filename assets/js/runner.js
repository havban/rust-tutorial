import { RESOLVED_API_BASE } from "./config.js";

const CLIENT_TIMEOUT_MS = 40000;

/**
 * Posts to the Worker. Resolves with the parsed payload, or throws an Error
 * whose message is already phrased for a human reading the output panel.
 */
export async function callApi(route, payload) {
  let res;
  try {
    res = await fetch(`${RESOLVED_API_BASE}/api/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error("Timed out waiting for the compiler. Try again.");
    }
    throw new Error(
      "Could not reach the backend. The lesson text works offline, but running code needs a network connection.",
    );
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error(
      `Backend returned a malformed response (HTTP ${res.status}).`,
    );
  }

  if (!res.ok) {
    throw new Error(data.error || `Backend error (HTTP ${res.status}).`);
  }
  return data;
}

export const run = (opts) => callApi("run", opts);
export const format = (opts) => callApi("format", opts);
export const clippy = (opts) => callApi("clippy", opts);

/** Build an "open this in the real playground" URL. */
export function playgroundLink(code, { edition = "2021", mode = "debug" } = {}) {
  const params = new URLSearchParams({
    version: "stable",
    mode,
    edition,
    code,
  });
  return `https://play.rust-lang.org/?${params}`;
}
