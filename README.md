# rust-tutorial

A Rust course you learn by running Rust. Fifty lessons from `fn main` to async,
macros and `unsafe` — each one with a complete, editable program that is
**compiled and executed by a real Rust toolchain** from the browser.

- **Site:** <https://havban.github.io/rust-tutorial/>
- **API:** <https://rust-tutorial.hidayat-febiansyah.workers.dev/api/health>

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

| # | Module | Lessons |
|---|---|---|
| 1 | Foundations | 6 |
| 2 | Compound data & control flow | 6 |
| 3 | Ownership & borrowing | 5 |
| 4 | Structs, enums & pattern matching | 6 |
| 5 | Collections & error handling | 6 |
| 6 | Generics, traits & lifetimes | 6 |
| 7 | Closures, iterators & smart pointers | 7 |
| 8 | Concurrency, async & beyond | 8 |

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
    index.js                ordered list of modules
    01-foundations.js ...   the content
worker/
  src/index.js              the Cloudflare Worker
  wrangler.toml
tools/
  verify-lessons.mjs        compiles every snippet; run before shipping content
  one.mjs                   compiles a single lesson and dumps diagnostics
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
  comment, a doc test) must be written `` \` ``.

Then verify before committing — this compiles and runs all 50 snippets against
the real toolchain and fails on any error:

```bash
node tools/verify-lessons.mjs            # everything
node tools/verify-lessons.mjs ownership  # one module or slug
node tools/one.mjs borrowing             # full diagnostics for one lesson
```

The GitHub Actions workflow re-checks lesson *metadata* on every push, but not
the compiles — those hit a shared public service, so they stay a manual step.

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
