# Notes for agents working in this repo

Read `README.md` first — it covers the layout, the backend and the authoring
format. This file records only the things that are easy to get wrong.

## Hard-won details

**Backticks in `code:` template literals.** Lesson `code` is a JS template
literal, so a backtick anywhere in the Rust source (doc comments, doc tests)
silently truncates the string and produces a confusing parse error *further down
the file*. Write them as `` \` ``.

This has bitten three times, so there is now a guard: **`node tools/check-sources.mjs`**
scans the files as text and names the exact line where a literal closed early.
It runs automatically at the top of `verify-lessons.mjs` and in CI. `node --check`
does *not* catch this.

**`body` is `md(...)`, not a template literal.** That is deliberate: prose is
full of Markdown code spans, and this way they need no escaping. Do not
"simplify" it into one template literal.

**Always run `node tools/verify-lessons.mjs` after touching lesson code.** It
compiles and runs all 61 snippets through the deployed Worker and fails on any
error *or* any compiler warning you have not accounted for. It back-offs
automatically when the Worker rate-limits it; a full run takes a few minutes.
`node tools/one.mjs <slug>` prints full diagnostics for a single lesson.

Lessons are expected to compile **warning-free**. A few deliberately define
unused shapes to show syntax; those carry an explicit
`#![allow(dead_code)]` with a comment at the top of the snippet.

**Two paths, one site.** `PATHS` in `assets/js/lessons/index.js` is the only
place that knows about the course/fast-track split; `app.js` derives the sidebar,
the progress denominator and prev/next from the *current lesson's* path. A new
module needs a `path` — `index.js` stamps it automatically from the array it
sits in.

**The cheatsheet PDF has two non-obvious requirements.** `tools/build-cheatsheet.mjs`
must force **screen** media (`page.pdf()` emulates print by default, which
reflows the layout) and pin `.sheet` to 1600px with four columns (the PDF lays
out at the *page* width, narrower than the browser viewport, which otherwise
trips the responsive breakpoint to three columns and spills onto page two). The
sheet also uses an explicit CSS grid rather than `columns: 4`, because multicol
fragments across pages in paginated media. Re-run the generator after editing
`cheatsheet.html` or `assets/css/cheatsheet.css`, and commit both artefacts.

**Path permalinks are generated in two places, and both must stay in sync.**
`#/fast-track` is handled by the router; `fast-track.html` is a *generated*
standalone page that exists purely so shared links get a real title, description
and Open Graph preview — a hash fragment is invisible to every crawler and
link-preview bot. After touching lesson titles, summaries, times or the `PATHS`
metadata, re-run `node tools/build-path-pages.mjs` and commit; CI fails if the
committed HTML is stale. Add `--og` only when the card design itself changes.

Path routes are matched **before** lesson slugs, so a lesson slug may never
equal a permalink or alias; `verify-lessons.mjs` enforces this.

**Slugs are permanent.** They are the URL fragment (`#/borrowing`) and the
`localStorage` key for a reader's saved edits and progress. Renaming one
silently discards their work.

**The `el()` helper drops falsy children.** Children are written as
`cond && el(...)`, so the guard skips `null`, `false` *and* `0` — without the
zero case a count of 0 renders as a stray "0" in the DOM. If you ever need a
literal `0` as text, wrap it: `String(n)`.

**CodeMirror load order.** `mode/rust/rust.min.js` is built with
`defineSimpleMode`, so `addon/mode/simple.min.js` must be loaded *before* it.
Get this wrong and the editor still works but silently loses all syntax
highlighting — easy to miss without looking at a screenshot.

**The API base.** `config.js` points at the deployed Worker by default, even on
localhost, so the page works when opened locally. Use `?api=…` or
`localStorage.rt.api` to point at `wrangler dev`.

## Deploying

- Site: push to `main`; `.github/workflows/pages.yml` does the rest.
- Worker: `cd worker && CLOUDFLARE_API_TOKEN="$(< ~/.cf-token)" npx wrangler deploy`

Git commits here need explicit identity env vars (`GIT_AUTHOR_NAME` etc.), and
pushing works over SSH only.

## Being a good citizen

The compiler on the other end is the public Rust Playground. The Worker exists
partly to protect it: edge caching, per-IP rate limiting, a code size cap and an
honest `User-Agent`. Do not remove those, and do not add anything that would
compile on every keystroke.
