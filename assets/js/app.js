import { MODULES } from "./lessons/index.js";
import { renderMarkdown, renderInline } from "./markdown.js";
import { createEditor } from "./editor.js";
import { run, format, clippy, playgroundLink } from "./runner.js";
import { REPO_URL } from "./config.js";

/* ------------------------------------------------------------------ model */

const LESSONS = [];
for (const mod of MODULES) {
  mod.lessons.forEach((lesson, idx) => {
    LESSONS.push({ ...lesson, module: mod, indexInModule: idx });
  });
}
const BY_SLUG = new Map(LESSONS.map((l) => [l.slug, l]));

/* ---------------------------------------------------------------- storage */

const KEY = {
  theme: "rt.theme",
  progress: "rt.progress",
  code: (slug) => `rt.code.${slug}`,
  opt: (name) => `rt.opt.${name}`,
  open: (id) => `rt.open.${id}`,
};

const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode / quota — progress simply will not persist */
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

let done = new Set(store.get(KEY.progress, []));
const saveProgress = () => store.set(KEY.progress, [...done]);

/* ------------------------------------------------------------------- dom */

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child);
  }
  return node;
};

const main = $("#lesson");
const tocEl = $("#toc");
const searchEl = $("#search");
const sidebar = $("#sidebar");
const scrim = $("#scrim");

/* ----------------------------------------------------------------- theme */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("#theme-icon").textContent = theme === "dark" ? "◐" : "◑";
  store.set(KEY.theme, theme);
}

applyTheme(
  store.get(KEY.theme) ||
    (window.matchMedia?.("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark"),
);

$("#theme-toggle").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

/* ------------------------------------------------------------- analytics */

/** count.js is async, so queue until it has attached itself to window. */
function countView(path, title) {
  let tries = 0;
  const tick = () => {
    if (window.goatcounter?.count) {
      window.goatcounter.count({ path, title, event: false });
    } else if (tries++ < 20) {
      setTimeout(tick, 250);
    }
  };
  tick();
}

/* ------------------------------------------------------------------ toast */

let toastTimer;
function toast(message) {
  document.querySelector(".toast")?.remove();
  const node = el("div", { className: "toast", textContent: message });
  document.body.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 2200);
}

/* -------------------------------------------------------------------- toc */

function buildToc(filter = "") {
  const needle = filter.trim().toLowerCase();
  tocEl.textContent = "";
  const currentSlug = routeSlug();
  let shown = 0;

  for (const mod of MODULES) {
    const matches = mod.lessons.filter((lesson) => {
      if (!needle) return true;
      return (
        lesson.title.toLowerCase().includes(needle) ||
        (lesson.summary || "").toLowerCase().includes(needle) ||
        (lesson.tags || []).some((t) => t.toLowerCase().includes(needle)) ||
        mod.title.toLowerCase().includes(needle)
      );
    });
    if (!matches.length) continue;
    shown += matches.length;

    const holdsCurrent = matches.some((l) => l.slug === currentSlug);
    const open = needle
      ? true
      : holdsCurrent || store.get(KEY.open(mod.id), false);

    const list = el(
      "ul",
      { className: "toc-list" },
      matches.map((lesson) =>
        el(
          "li",
          {},
          el(
            "a",
            {
              className: "toc-link",
              href: `#/${lesson.slug}`,
              ...(lesson.slug === currentSlug ? { ariaCurrent: "page" } : {}),
            },
            el("span", {
              className: "toc-tick",
              textContent: done.has(lesson.slug) ? "✓" : "",
              ariaHidden: "true",
            }),
            el("span", { textContent: lesson.title }),
          ),
        ),
      ),
    );

    const head = el(
      "button",
      { className: "toc-module-head", type: "button" },
      el("span", { className: "toc-caret", textContent: "▶", ariaHidden: "true" }),
      el("span", { className: "toc-module-num", textContent: String(mod.n) }),
      el("span", { textContent: mod.title }),
    );

    const wrap = el("div", { className: "toc-module" }, head, list);
    wrap.dataset.open = String(open);
    head.setAttribute("aria-expanded", String(open));
    head.addEventListener("click", () => {
      const next = wrap.dataset.open !== "true";
      wrap.dataset.open = String(next);
      head.setAttribute("aria-expanded", String(next));
      store.set(KEY.open(mod.id), next);
    });

    tocEl.append(wrap);
  }

  if (!shown) {
    tocEl.append(
      el("p", {
        className: "toc-empty",
        textContent: `Nothing matches “${filter}”.`,
      }),
    );
  }
}

function updateProgressPill() {
  $("#progress-count").textContent = String(done.size);
  $("#progress-pill").lastElementChild.textContent = `/${LESSONS.length}`;
}

/* ------------------------------------------------------------------ route */

const routeSlug = () => decodeURIComponent(location.hash.replace(/^#\/?/, ""));

/* ------------------------------------------------------------ output pane */

/** Colourise cargo/rustc output without pulling in a highlighter. */
function renderStream(parent, label, text, { dimNoise = false } = {}) {
  if (!text) return;
  parent.append(
    el("span", { className: "stream-label", textContent: label }),
  );
  for (const line of text.replace(/\n$/, "").split("\n")) {
    let cls = "";
    if (/^(error|thread '.*' panicked)/i.test(line) || /^\s*\|\s*\^/.test(line)) {
      cls = "e";
    } else if (/^warning/i.test(line)) {
      cls = "w";
    } else if (
      dimNoise &&
      /^\s*(Compiling|Finished|Running|Checking|Updating|Downloaded|Compiling)\b/.test(
        line,
      )
    ) {
      cls = "dimmed";
    }
    parent.append(el("span", { className: cls, textContent: line + "\n" }));
  }
}

/* ----------------------------------------------------------------- lesson */

function renderLesson(lesson) {
  const flatIndex = LESSONS.indexOf(lesson);
  const prev = LESSONS[flatIndex - 1];
  const next = LESSONS[flatIndex + 1];

  main.textContent = "";

  main.append(
    el("div", {
      className: "crumb",
      textContent: `Module ${lesson.module.n} · ${lesson.module.title}`,
    }),
    el("h1", { textContent: lesson.title }),
    lesson.summary &&
      el("p", { className: "lesson-sub", innerHTML: renderInline(lesson.summary) }),
    (lesson.tags || []).length &&
      el(
        "div",
        { className: "tagrow" },
        lesson.tags.map((t) => el("span", { className: "tag", textContent: t })),
      ),
  );

  const prose = el("div", { className: "prose" });
  prose.innerHTML = renderMarkdown(lesson.body || "");
  main.append(prose);

  /* ---- live playground ---- */

  const isTestLesson = lesson.tests === true;
  const savedCode = store.get(KEY.code(lesson.slug));
  const startingCode = typeof savedCode === "string" ? savedCode : lesson.code;

  const out = el("pre", { className: "out-body" });
  out.append(
    el("span", {
      className: "out-placeholder",
      textContent: isTestLesson
        ? "Press “Run tests” to compile and run the test suite."
        : "Press “Run” (or Ctrl+Enter) to compile and execute this program.",
    }),
  );

  const status = el("span", { className: "status", textContent: "idle" });
  const chip = el("span", { className: "chip", hidden: true });

  const editorMount = el("div", { className: "editor-wrap" });
  let editor;

  const options = () => ({
    edition: store.get(KEY.opt("edition"), "2021"),
    mode: store.get(KEY.opt("mode"), "debug"),
    channel: store.get(KEY.opt("channel"), "stable"),
  });

  function setStatus(kind, text, { spinner = false } = {}) {
    status.className = `status ${kind}`;
    status.textContent = "";
    if (spinner) {
      status.append(el("span", { className: "spin", textContent: "⟳" }));
    }
    status.append(document.createTextNode(" " + text));
  }

  const busy = (on) => {
    for (const b of [runBtn, fmtBtn, clippyBtn]) b.disabled = on;
  };

  async function doRun({ silent = false } = {}) {
    const code = editor.getValue();
    store.set(KEY.code(lesson.slug), code);
    busy(true);
    chip.hidden = true;
    setStatus("busy", isTestLesson ? "running tests…" : "compiling…", {
      spinner: true,
    });
    out.textContent = "";

    try {
      const opts = options();
      const res = await run({
        code,
        ...opts,
        tests: isTestLesson,
        crateType: isTestLesson ? "lib" : "bin",
      });

      out.textContent = "";
      renderStream(out, isTestLesson ? "test output" : "stdout", res.stdout);
      renderStream(out, "compiler", res.stderr, { dimNoise: true });
      if (!res.stdout && !res.stderr) {
        out.append(
          el("span", {
            className: "out-placeholder",
            textContent: "(the program produced no output)",
          }),
        );
      }

      const failed =
        !res.success ||
        /^error(\[|:)/m.test(res.stderr || "") ||
        /test result: FAILED/.test(res.stdout || "");
      setStatus(
        failed ? "err" : "ok",
        failed ? "did not compile / failed" : "success",
      );
      chip.hidden = false;
      chip.textContent = `${opts.channel} · ${opts.mode} · edition ${opts.edition}${
        res.cached ? " · cached" : ""
      }`;
      return res;
    } catch (err) {
      out.textContent = "";
      renderStream(out, "error", err.message);
      setStatus("err", "backend error");
      if (!silent) toast(err.message);
      return null;
    } finally {
      busy(false);
    }
  }

  async function doFormat() {
    busy(true);
    setStatus("busy", "running rustfmt…", { spinner: true });
    try {
      const res = await format({
        code: editor.getValue(),
        edition: options().edition,
      });
      if (res.code) {
        editor.setValue(res.code);
        store.set(KEY.code(lesson.slug), res.code);
        setStatus("ok", "formatted");
        toast("rustfmt applied");
      } else {
        out.textContent = "";
        renderStream(out, "rustfmt", res.stderr || "rustfmt made no changes.");
        setStatus("err", "rustfmt could not parse this");
      }
    } catch (err) {
      setStatus("err", "backend error");
      toast(err.message);
    } finally {
      busy(false);
    }
  }

  async function doClippy() {
    busy(true);
    setStatus("busy", "running clippy…", { spinner: true });
    out.textContent = "";
    try {
      const res = await clippy({
        code: editor.getValue(),
        ...options(),
        tests: isTestLesson,
        crateType: isTestLesson ? "lib" : "bin",
      });
      renderStream(out, "clippy", res.stderr || res.stdout, { dimNoise: true });
      const clean = !/^(warning|error)/m.test(res.stderr || "");
      if (clean) {
        out.append(
          el("span", {
            className: "out-placeholder",
            textContent: "clippy is happy with this code.",
          }),
        );
      }
      setStatus(clean ? "ok" : "err", clean ? "no lints" : "clippy has notes");
    } catch (err) {
      renderStream(out, "error", err.message);
      setStatus("err", "backend error");
    } finally {
      busy(false);
    }
  }

  const runBtn = el(
    "button",
    { className: "btn btn-primary", type: "button" },
    el("span", { ariaHidden: "true", textContent: isTestLesson ? "🧪" : "▶" }),
    document.createTextNode(isTestLesson ? " Run tests" : " Run"),
    el("kbd", { textContent: "⌃↩" }),
  );
  runBtn.addEventListener("click", () => doRun());

  const fmtBtn = el("button", {
    className: "btn",
    type: "button",
    textContent: "Format",
    title: "Reformat with rustfmt",
  });
  fmtBtn.addEventListener("click", doFormat);

  const clippyBtn = el("button", {
    className: "btn",
    type: "button",
    textContent: "Clippy",
    title: "Lint with clippy",
  });
  clippyBtn.addEventListener("click", doClippy);

  const resetBtn = el("button", {
    className: "btn btn-ghost",
    type: "button",
    textContent: "Reset",
    title: "Restore the original example",
  });
  resetBtn.addEventListener("click", () => {
    editor.setValue(lesson.code);
    store.del(KEY.code(lesson.slug));
    toast("Example restored");
  });

  const openBtn = el("a", {
    className: "btn btn-ghost",
    target: "_blank",
    rel: "noopener",
    textContent: "Playground ↗",
    title: "Open this snippet on play.rust-lang.org",
    href: "#",
  });
  openBtn.addEventListener("click", (e) => {
    e.currentTarget.href = playgroundLink(editor.getValue(), options());
  });

  function optionSelect(name, values, label) {
    const sel = el(
      "select",
      { className: "mini", title: label, ariaLabel: label },
      values.map((v) =>
        el("option", {
          value: v,
          textContent: v,
          selected: store.get(KEY.opt(name), values[0]) === v,
        }),
      ),
    );
    sel.addEventListener("change", () => store.set(KEY.opt(name), sel.value));
    return sel;
  }

  const card = el(
    "section",
    { className: "card" },
    el(
      "div",
      { className: "card-head" },
      el(
        "span",
        { className: "card-label" },
        el("span", { ariaHidden: "true", textContent: "🦀" }),
        document.createTextNode(isTestLesson ? "Live tests" : "Live demo"),
      ),
      optionSelect("edition", ["2021", "2024", "2018", "2015"], "Rust edition"),
      optionSelect("mode", ["debug", "release"], "Build mode"),
      optionSelect("channel", ["stable", "beta", "nightly"], "Toolchain channel"),
      openBtn,
      resetBtn,
      clippyBtn,
      fmtBtn,
      runBtn,
    ),
    editorMount,
    el(
      "div",
      { className: "out" },
      el(
        "div",
        { className: "out-head" },
        document.createTextNode("output"),
        status,
        chip,
      ),
      out,
    ),
  );
  main.append(card);

  editor = createEditor(editorMount, {
    value: startingCode,
    onRun: () => doRun(),
  });

  /* ---- exercise ---- */

  if (lesson.exercise) {
    const result = el("span", { className: "exercise-result" });
    const checkBtn = el("button", {
      className: "btn btn-primary",
      type: "button",
      textContent: "Check my answer",
    });

    checkBtn.addEventListener("click", async () => {
      checkBtn.disabled = true;
      result.className = "exercise-result";
      result.textContent = "Checking…";
      const res = await doRun({ silent: true });
      checkBtn.disabled = false;

      if (!res) {
        result.className = "exercise-result err";
        result.textContent = "Could not run your code — see the output above.";
        return;
      }
      if (!res.success) {
        result.className = "exercise-result err";
        result.textContent = "It does not compile yet — read the compiler output.";
        return;
      }

      const expect = lesson.exercise.expect || {};
      const stdout = (res.stdout || "").trim();
      const problems = [];

      if (typeof expect.stdout === "string" && stdout !== expect.stdout.trim()) {
        problems.push("the output is not what the exercise asks for");
      }
      for (const needle of expect.contains || []) {
        if (!stdout.includes(needle)) problems.push(`output is missing “${needle}”`);
      }
      for (const needle of expect.sourceContains || []) {
        if (!editor.getValue().includes(needle)) {
          problems.push(`your code should use “${needle}”`);
        }
      }

      if (problems.length) {
        result.className = "exercise-result err";
        result.textContent = `Not quite — ${problems[0]}.`;
      } else {
        result.className = "exercise-result ok";
        result.textContent = "✓ Correct. Nice work.";
        if (!done.has(lesson.slug)) {
          done.add(lesson.slug);
          saveProgress();
          updateProgressPill();
          buildToc(searchEl.value);
          markDoneBtn.textContent = "✓ Marked as done";
        }
      }
    });

    const exBody = el("div", { className: "prose" });
    exBody.innerHTML = renderMarkdown(lesson.exercise.prompt);

    main.append(
      el(
        "section",
        { className: "exercise" },
        el("div", { className: "exercise-label", textContent: "Your turn" }),
        exBody,
        el("div", { className: "exercise-actions" }, checkBtn, result),
        lesson.exercise.hint &&
          (() => {
            const hint = el("details", { className: "hint" });
            hint.append(el("summary", { textContent: "Show a hint" }));
            const hb = el("div", { className: "prose" });
            hb.innerHTML = renderMarkdown(lesson.exercise.hint);
            hint.append(hb);
            return hint;
          })(),
      ),
    );
  }

  /* ---- done + nav ---- */

  const markDoneBtn = el("button", {
    className: done.has(lesson.slug) ? "btn" : "btn btn-primary",
    type: "button",
    textContent: done.has(lesson.slug) ? "✓ Marked as done" : "Mark as done",
  });
  markDoneBtn.addEventListener("click", () => {
    if (done.has(lesson.slug)) {
      done.delete(lesson.slug);
      markDoneBtn.textContent = "Mark as done";
      markDoneBtn.className = "btn btn-primary";
    } else {
      done.add(lesson.slug);
      markDoneBtn.textContent = "✓ Marked as done";
      markDoneBtn.className = "btn";
    }
    saveProgress();
    updateProgressPill();
    buildToc(searchEl.value);
  });

  main.append(
    el(
      "div",
      { className: "done-row" },
      markDoneBtn,
      el("span", {
        className: "out-placeholder",
        textContent: `Lesson ${flatIndex + 1} of ${LESSONS.length}`,
      }),
    ),
  );

  const navCard = (lsn, dir) =>
    el(
      "a",
      { className: `nav-card ${dir}`, href: `#/${lsn.slug}` },
      el("span", {
        className: "nav-dir",
        textContent: dir === "prev" ? "← Previous" : "Next →",
      }),
      el("span", { className: "nav-title", textContent: lsn.title }),
    );

  main.append(
    el(
      "nav",
      { className: "lesson-nav" },
      prev ? navCard(prev, "prev") : el("div", { className: "nav-card", style: "visibility:hidden" }),
      next ? navCard(next, "next") : el("div", { className: "nav-card", style: "visibility:hidden" }),
    ),
  );

  requestAnimationFrame(() => editor.refresh());
}

/* ------------------------------------------------------------------- home */

function renderHome() {
  main.textContent = "";
  const firstSlug = LESSONS[0].slug;

  const hero = el("div", { className: "hero" });
  hero.append(
    el("h1", { textContent: "Learn Rust by running Rust." }),
    el("p", {
      textContent:
        "Fifty-odd lessons from “hello world” to async, unsafe and macros. Every one ships with a complete, editable program that you compile and execute against a real Rust toolchain — right here, no install, no setup.",
    }),
    el(
      "div",
      { className: "hero-cta" },
      el("a", {
        className: "btn btn-primary btn-lg",
        href: `#/${firstSlug}`,
        textContent: "Start from the beginning",
      }),
      done.size > 0 &&
        el("a", {
          className: "btn btn-lg",
          href: `#/${(LESSONS.find((l) => !done.has(l.slug)) || LESSONS[0]).slug}`,
          textContent: `Resume (${done.size} done)`,
        }),
      el("a", {
        className: "btn btn-lg",
        href: REPO_URL,
        target: "_blank",
        rel: "noopener",
        textContent: "Source on GitHub",
      }),
    ),
  );
  main.append(hero);

  main.append(
    el(
      "div",
      { className: "feature-grid" },
      [
        [
          "A real compiler",
          "Not a simulation. Your code is compiled by rustc on the official Rust Playground, so the errors you see are the errors you would get locally.",
        ],
        [
          "Edit everything",
          "Break the examples on purpose. Switch edition, build in release, run clippy, reformat with rustfmt — then read what the compiler says.",
        ],
        [
          "Exercises that check themselves",
          "Most lessons end with a small task. Press Check and the real output is compared against what the task asked for.",
        ],
        [
          "Your place is kept",
          "Progress and your edits live in this browser's local storage. Close the tab and come back to exactly where you left off.",
        ],
      ].map(([h, p]) =>
        el("div", { className: "feature" }, el("h3", { textContent: h }), el("p", { textContent: p })),
      ),
    ),
  );

  main.append(el("h2", { textContent: "The curriculum", style: "margin-top:34px" }));
  main.append(
    el(
      "div",
      { className: "module-grid" },
      MODULES.map((mod) =>
        el(
          "a",
          { className: "module-card", href: `#/${mod.lessons[0].slug}` },
          el(
            "div",
            { className: "module-card-top" },
            el("span", { className: "module-card-n", textContent: String(mod.n).padStart(2, "0") }),
            el("h3", { textContent: mod.title }),
            el("span", {
              className: "module-card-count",
              textContent: `${mod.lessons.filter((l) => done.has(l.slug)).length}/${mod.lessons.length}`,
            }),
          ),
          el("p", { innerHTML: renderInline(mod.summary) }),
        ),
      ),
    ),
  );

  const note = el("div", { className: "prose", style: "margin-top:34px" });
  note.innerHTML = renderMarkdown(
    [
      "## How the live demos work",
      "",
      "This site is plain static HTML on GitHub Pages — there is no server rendering it. When you press **Run**, the editor contents are POSTed to a small Cloudflare Worker, which forwards them to [play.rust-lang.org](https://play.rust-lang.org) (the browser cannot call the playground directly because it sends no CORS headers).",
      "",
      "The Worker whitelists the request fields, caps code size, rate-limits per IP, and caches successful runs at the edge for an hour — so re-running an unmodified example is instant and costs the shared playground nothing.",
      "",
      "> The playground has no network access and no filesystem, and programs are killed after a few seconds. A handful of popular crates are available, which a few of the later lessons use.",
    ].join("\n"),
  );
  main.append(note);
}

/* ------------------------------------------------------------------ router */

function route() {
  const slug = routeSlug();
  const lesson = slug ? BY_SLUG.get(slug) : null;

  if (slug && !lesson) {
    main.textContent = "";
    main.append(
      el("h1", { textContent: "Lesson not found" }),
      el("p", {
        className: "lesson-sub",
        textContent: `There is no lesson called “${slug}”.`,
      }),
      el("a", {
        className: "btn btn-primary",
        href: "#/",
        textContent: "Back to the start",
      }),
    );
  } else if (lesson) {
    renderLesson(lesson);
    document.title = `${lesson.title} · Rust Tutorial`;
  } else {
    renderHome();
    document.title = "Rust Tutorial — learn Rust with a live compiler";
  }

  buildToc(searchEl.value);
  updateProgressPill();
  closeSidebar();
  main.scrollIntoView({ block: "start" });
  window.scrollTo({ top: 0 });
  countView(`/${slug}` === "/" ? "/" : `/${slug}`, document.title);
}

window.addEventListener("hashchange", route);

/* ----------------------------------------------------------------- chrome */

function openSidebar() {
  sidebar.dataset.open = "true";
  scrim.hidden = false;
  $("#sidebar-toggle").setAttribute("aria-expanded", "true");
}
function closeSidebar() {
  sidebar.dataset.open = "false";
  scrim.hidden = true;
  $("#sidebar-toggle").setAttribute("aria-expanded", "false");
}

$("#sidebar-toggle").addEventListener("click", () =>
  sidebar.dataset.open === "true" ? closeSidebar() : openSidebar(),
);
scrim.addEventListener("click", closeSidebar);

searchEl.addEventListener("input", () => buildToc(searchEl.value));
searchEl.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    searchEl.value = "";
    buildToc("");
    searchEl.blur();
  }
});

$("#reset-progress").addEventListener("click", () => {
  if (!done.size) return toast("No progress saved yet");
  done = new Set();
  saveProgress();
  updateProgressPill();
  buildToc(searchEl.value);
  toast("Progress cleared");
});

document.addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) ||
    e.target.closest?.(".CodeMirror");
  if (e.key === "/" && !typing) {
    e.preventDefault();
    searchEl.focus();
    searchEl.select();
  }
  if (!typing && (e.key === "[" || e.key === "]")) {
    const current = BY_SLUG.get(routeSlug());
    if (!current) return;
    const target = LESSONS[LESSONS.indexOf(current) + (e.key === "]" ? 1 : -1)];
    if (target) location.hash = `#/${target.slug}`;
  }
});

route();
