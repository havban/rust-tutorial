# rust-tutorial

A Rust course you learn by running Rust. Sixty-one lessons across two paths, each
one with a complete, editable program that is **compiled and executed by a real
Rust toolchain** from the browser.

- **Site:** <https://havban.github.io/rust-tutorial/>
- **Fast track:** <https://havban.github.io/rust-tutorial/fast-track.html> — Rust in one hour
- **Full course:** <https://havban.github.io/rust-tutorial/full-course.html>
- **Cheatsheet:** <https://havban.github.io/rust-tutorial/cheatsheet.html>
  ([PDF](assets/cheatsheet/rust-cheatsheet.pdf) · [PNG](assets/cheatsheet/rust-cheatsheet.png))
- **API:** <https://rust-tutorial.hidayat-febiansyah.workers.dev/api/health>

## Two paths

| | **Full course** | **Fast track** |
|---|---|---|
| For | New to Rust, or to systems programming | You already ship software in another language |
| Size | 50 lessons, 8 modules | 11 lessons, 4 modules, ~60 minutes |
| Approach | First principles, nothing assumed | Skips the syntax tour; spends the hour on the ownership model, idioms, API conventions and judgement calls |

Both paths share the same machinery — live compiler, exercises, progress — and
`PATHS` in `assets/js/lessons/index.js` is the only place that knows about the
split. Prev/next and the progress counter stay inside a path; opening a lesson
switches the sidebar to its path automatically.

### Permalinks

Each path has a stable link, in two forms:

| | Use for |
|---|---|
| `fast-track.html` / `full-course.html` | **sharing.** Real URLs with their own `<title>`, description and Open Graph image, so Slack/WhatsApp/Twitter/Google render a proper preview |
| `#/fast-track` / `#/full-course` | in-app navigation. Renders the same overview inside the SPA |

Aliases `#/fast`, `#/one-hour`, `#/path/fast`, `#/course`, `#/path/course` all
resolve and rewrite themselves to the canonical fragment.

The `.html` pages are **generated** from the lesson data by
`tools/build-path-pages.mjs`, so the lesson list cannot drift. CI regenerates
them and fails if the committed copies are stale. Path permalinks are resolved
before lesson slugs, and `verify-lessons.mjs` fails the build if a lesson slug
ever collides with one.

```bash
node tools/build-path-pages.mjs        # regenerate the HTML
node tools/build-path-pages.mjs --og   # ...and the social preview images
```

## What it does

- **Live demos.** Every lesson has a full program in a CodeMirror editor. Press
  Run (or `Ctrl`+`Enter`) and the real `rustc` output comes back — including the
  compile errors, which the lessons deliberately invite you to trigger.
- **rustfmt and clippy** on the same code, from the toolbar.
- **Self-checking exercises.** Most lessons end with a task; pressing *Check my
  answer* runs your code and compares the actual stdout (and sometimes the
  source) against what the task asked for.
- **Edition / build mode / channel** switches, so you can see what changes
  between 2015 and 2024, or between debug and release.
- **Progress and edits persist** in `localStorage`, per lesson.
- Dark and light themes, search, keyboard nav (`/` to search, `[` / `]` to move
  between lessons), and a mobile drawer.

## Curriculum

**Full course** — Foundations (6) · Compound data & control flow (6) · Ownership
& borrowing (5) · Structs, enums & pattern matching (6) · Collections & error
handling (6) · Generics, traits & lifetimes (6) · Closures, iterators & smart
pointers (7) · Concurrency, async & beyond (8).

**Fast track** — The core model (3: the mental model, ownership at speed, types
as the design tool) · Writing it idiomatically (3: errors, traits & dispatch,
iterators) · Engineering decisions (3: API design, the concurrency decision
tree, performance reality) · Shipping it (2: cargo & tooling, the mistakes that
cost everyone their first week).

## Cheatsheet

`cheatsheet.html` is a one-page reference covering syntax, ownership,
collections, pattern matching, errors, traits, iterators, smart pointers,
concurrency, cargo and the idioms worth internalising.

It is the single source of truth; the committed
`assets/cheatsheet/rust-cheatsheet.{pdf,png}` are generated from it:

```bash
python3 -m http.server 8099       # in another shell
node tools/build-cheatsheet.mjs   # regenerate both artefacts
```

The PDF is a single exact-fit page with selectable vector text. Two things the
generator has to do, both non-obvious: force **screen** media (`page.pdf()`
emulates print by default, which reflows the layout) and pin the sheet width
(the PDF lays out at the *page* width, which is narrower than the browser
viewport and would otherwise trip the responsive breakpoint down to three
columns and spill onto a second page).

## How it is put together

```
index.html                  the whole UI shell
assets/css/style.css        tokens, layout, both themes
assets/js/
  app.js                    router, TOC, lesson rendering, exercise checking
  config.js                 which backend to talk to
  editor.js                 CodeMirror 5 wrapper, degrades to a <textarea>
  markdown.js               small Markdown subset renderer (no dependency)
  runner.js                 fetch wrapper around the Worker
  lessons/
    index.js                PATHS, and the module ordering
    01-foundations.js ...   the full course
    fast-track.js           the one-hour path
fast-track.html             GENERATED shareable landing page
full-course.html            GENERATED shareable landing page
assets/og/                  GENERATED social preview images
assets/css/landing.css
cheatsheet.html             one-page reference (source of truth)
assets/css/cheatsheet.css
assets/cheatsheet/          generated rust-cheatsheet.{pdf,png}
worker/
  src/index.js              the Cloudflare Worker
  wrangler.toml
tools/
  check-sources.mjs         guards the backtick trap below (instant, text only)
  verify-lessons.mjs        compiles every snippet; run before shipping content
  one.mjs                   compiles a single lesson and dumps diagnostics
  smoke.mjs                 drives the UI with Playwright
  build-cheatsheet.mjs      regenerates the cheatsheet PDF and PNG
  build-path-pages.mjs      regenerates the shareable landing pages
```

There is **no build step**. The site is static files served by GitHub Pages;
the lesson content is plain ES modules loaded by the browser.

### The backend, and why there is one

GitHub Pages serves static files, and `play.rust-lang.org` sends no CORS
headers, so the browser cannot call it directly. The Worker sits in between and:

- whitelists and clamps every request field (channel, mode, edition, crate type)
  rather than forwarding what the browser sent,
- caps submitted code at 50 KB,
- rate-limits per IP (40 requests/minute per isolate),
- **caches successful runs at the edge for an hour**, keyed on a hash of the
  request — so re-running an unmodified example is instant and costs the shared
  playground nothing,
- normalises the playground's two spellings of `exitDetail`/`exit_detail`.

Routes: `POST /api/run`, `POST /api/format`, `POST /api/clippy`,
`GET /api/health`.

## Working on it

```bash
# Serve the site
python3 -m http.server 8099     # then open http://127.0.0.1:8099

# Run the Worker locally, and point the page at it
cd worker && npx wrangler dev --port 8787
#   open http://127.0.0.1:8099/?api=http://127.0.0.1:8787
#   (or localStorage.setItem("rt.api", "http://127.0.0.1:8787"))

# Deploy the Worker
cd worker && CLOUDFLARE_API_TOKEN="$(< ~/.cf-token)" npx wrangler deploy
```

By default the page always talks to the deployed Worker, including from
localhost, so opening it locally just works.

### Adding or changing a lesson

Lessons live in `assets/js/lessons/NN-*.js` as plain objects:

```js
{
  slug: "borrowing",            // permanent: it is the URL and the storage key
  title: "References and borrowing",
  summary: "...",               // inline Markdown is rendered
  tags: ["&", "borrow"],
  body: md("line", "", "line"), // Markdown, as an array of lines
  code: `fn main() { ... }`,    // the live demo
  tests: true,                  // optional: compile as a lib and run the tests
  exercise: {
    prompt: "...",
    expect: { contains: ["..."], stdout: "...", sourceContains: ["..."] },
    hint: "...",
  },
}
```

Two authoring rules, both about JavaScript quoting:

- `body` is written as **lines passed to `md()`** rather than one template
  literal, so Markdown backticks need no escaping.
- `code` **is** a template literal, so any backtick inside Rust source (a doc
  comment, a doc test) must be written `` \` ``. An unescaped one ends the
  string silently and the parse error surfaces hundreds of lines later, so
  `tools/check-sources.mjs` scans for it and names the exact line. It runs
  first inside `verify-lessons.mjs` and in CI.

Then verify before committing — this compiles and runs all 50 snippets against
the real toolchain and fails on any error:

```bash
node tools/check-sources.mjs             # instant backtick guard
node tools/verify-lessons.mjs            # everything (61 snippets)
node tools/verify-lessons.mjs ft-        # one module, path prefix or slug
node tools/one.mjs borrowing             # full diagnostics for one lesson
```

Lessons are expected to compile **warning-free**. A few deliberately define
unused shapes to show syntax; those carry an explicit `#![allow(dead_code)]`
with a comment at the top of the snippet.

The GitHub Actions workflow re-checks lesson *metadata* on every push, but not
the compiles — those hit a shared public service, so they stay a manual step.

### Browser smoke test

`tools/smoke.mjs` drives the real UI with Playwright: it renders every lesson
and exercises Run, Format, Clippy, the self-checking exercise, progress
persistence, routing and the mobile drawer.

```bash
npm i -D playwright && npx playwright install chromium
python3 -m http.server 8099                             # in another shell
node tools/smoke.mjs                                    # local site
node tools/smoke.mjs https://havban.github.io/rust-tutorial/   # live site
```

## Deployment

Pushing to `main` triggers `.github/workflows/pages.yml`, which validates the
curriculum and publishes the repository root to GitHub Pages. The Worker is
deployed separately with `wrangler`.

## Analytics

Page views go to [GoatCounter](https://havban.goatcounter.com). The site is
hash-routed, so `no_onload` is set and `app.js` counts each lesson view itself.

## Credits

Code execution is provided by the [Rust Playground](https://play.rust-lang.org),
run by the Rust project. The Worker caches and rate-limits specifically to be a
good citizen of that shared service. Editor is
[CodeMirror 5](https://codemirror.net/5/).
