# Notes for agents working in this repo

Read `README.md` first — it covers the layout, the backend and the authoring
format. This file records only the things that are easy to get wrong.

## Hard-won details

**Backticks in `code:` template literals.** Lesson `code` is a JS template
literal, so a backtick anywhere in the Rust source (doc comments, doc tests)
silently truncates the string and produces a confusing parse error *further down
the file*. Write them as `` \` ``. `node --check` does **not** catch this on
these files; `node -e "import('./assets/js/lessons/index.js')"` does.

**`body` is `md(...)`, not a template literal.** That is deliberate: prose is
full of Markdown code spans, and this way they need no escaping. Do not
"simplify" it into one template literal.

**Always run `node tools/verify-lessons.mjs` after touching lesson code.** It
compiles and runs all 50 snippets through the deployed Worker and fails on any
error *or* any compiler warning you have not accounted for. It back-offs
automatically when the Worker rate-limits it; a full run takes a few minutes.
`node tools/one.mjs <slug>` prints full diagnostics for a single lesson.

Lessons are expected to compile **warning-free**. A few deliberately define
unused shapes to show syntax; those carry an explicit
`#![allow(dead_code)]` with a comment at the top of the snippet.

**Slugs are permanent.** They are the URL fragment (`#/borrowing`) and the
`localStorage` key for a reader's saved edits and progress. Renaming one
silently discards their work.

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
