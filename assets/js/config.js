/** Deployed Cloudflare Worker that proxies the Rust Playground. */
export const API_BASE = "https://rust-tutorial.hidayat-febiansyah.workers.dev";

/**
 * The deployed Worker is used everywhere by default — including when the site
 * is served from localhost — so opening the page locally just works. To develop
 * against `wrangler dev`, override it with either:
 *
 *   index.html?api=http://127.0.0.1:8787
 *   localStorage.setItem("rt.api", "http://127.0.0.1:8787")
 */
function resolveApiBase() {
  try {
    const fromQuery = new URLSearchParams(location.search).get("api");
    if (fromQuery) return fromQuery.replace(/\/+$/, "");
    const stored = localStorage.getItem("rt.api");
    if (stored) return stored.replace(/\/+$/, "");
  } catch {
    /* no URL or storage access — fall through to the default */
  }
  return API_BASE;
}

export const RESOLVED_API_BASE = resolveApiBase();

export const PLAYGROUND_URL = "https://play.rust-lang.org";
export const REPO_URL = "https://github.com/havban/rust-tutorial";
