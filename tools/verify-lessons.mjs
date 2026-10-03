#!/usr/bin/env node
/**
 * Compiles and runs every lesson's example through the deployed Worker, so a
 * broken snippet can never reach the site. Also sanity-checks lesson metadata.
 *
 *   node tools/verify-lessons.mjs                  # all lessons
 *   node tools/verify-lessons.mjs ownership        # only slugs containing this
 *   API=http://127.0.0.1:8787 node tools/...       # against a local worker
 */

import { MODULES } from "../assets/js/lessons/index.js";

const API = process.env.API || "https://rust-tutorial.hidayat-febiansyah.workers.dev";
const filter = process.argv[2] || "";
const CONCURRENCY = 4;

const lessons = MODULES.flatMap((m) =>
  m.lessons.map((l) => ({ ...l, module: m.title, moduleN: m.n })),
).filter((l) => !filter || l.slug.includes(filter) || l.module.toLowerCase().includes(filter));

/* ---- static checks ---- */

const problems = [];
const seen = new Set();

for (const mod of MODULES) {
  if (!mod.id || !mod.n || !mod.title || !mod.summary) {
    problems.push(`module ${mod.id || "?"} is missing metadata`);
  }
  for (const l of mod.lessons) {
    if (seen.has(l.slug)) problems.push(`duplicate slug: ${l.slug}`);
    seen.add(l.slug);
    for (const field of ["slug", "title", "summary", "body", "code"]) {
      if (!l[field]) problems.push(`${l.slug}: missing ${field}`);
    }
    if (!/^[a-z0-9-]+$/.test(l.slug)) problems.push(`${l.slug}: slug must be kebab-case`);
    if (l.code && !l.tests && !l.code.includes("fn main")) {
      problems.push(`${l.slug}: no fn main and not marked tests:true`);
    }
    if (l.code?.includes("\t")) problems.push(`${l.slug}: code contains a tab`);
    if (l.exercise && !l.exercise.expect) {
      problems.push(`${l.slug}: exercise has no expect block`);
    }
  }
}

if (problems.length) {
  console.error("Metadata problems:");
  for (const p of problems) console.error("  x " + p);
} else {
  console.log(`Metadata OK — ${MODULES.length} modules, ${seen.size} lessons.`);
}

/* ---- compile every snippet ---- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(lesson, attempt = 0) {
  const res = await fetch(`${API}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: lesson.code,
      edition: lesson.edition || "2021",
      mode: "debug",
      channel: "stable",
      tests: lesson.tests === true,
      crateType: lesson.tests === true ? "lib" : "bin",
    }),
    signal: AbortSignal.timeout(90_000),
  });

  // The worker rate-limits on purpose; back off rather than reporting a failure.
  if (res.status === 429 && attempt < 6) {
    const wait = Number(res.headers.get("Retry-After") || 10) + 1;
    console.log(`  ...  ${lesson.slug}: rate limited, waiting ${wait}s`);
    await sleep(wait * 1000);
    return post(lesson, attempt + 1);
  }
  return res;
}

async function check(lesson) {
  const res = await post(lesson);

  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (data.error) return { lesson, ok: false, detail: data.error };

  const stderr = data.stderr || "";
  const hardError = !data.success || /^error(\[|:)/m.test(stderr);
  const warnings = [...stderr.matchAll(/^warning: (.+)$/gm)].map((m) => m[1]);

  return {
    lesson,
    ok: !hardError,
    cached: data.cached,
    warnings,
    detail: hardError
      ? stderr
          .split("\n")
          .filter((l) => /^(error|warning|\s+-->)/.test(l))
          .slice(0, 12)
          .join("\n")
      : "",
  };
}

const results = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < lessons.length) {
      const lesson = lessons[cursor++];
      try {
        results.push(await check(lesson));
      } catch (err) {
        results.push({ lesson, ok: false, detail: `request failed: ${err.message}` });
      }
    }
  }),
);

results.sort(
  (a, b) =>
    a.lesson.moduleN - b.lesson.moduleN || a.lesson.slug.localeCompare(b.lesson.slug),
);

let failed = 0;
let warned = 0;
for (const r of results) {
  const warn = r.warnings?.length ? ` (${r.warnings.length} warning(s))` : "";
  if (r.ok) {
    if (r.warnings?.length) warned++;
    console.log(`  ok   ${r.lesson.moduleN}.${r.lesson.slug}${warn}${r.cached ? " [cached]" : ""}`);
    for (const w of r.warnings || []) console.log(`         warning: ${w}`);
  } else {
    failed++;
    console.log(`  FAIL ${r.lesson.moduleN}.${r.lesson.slug}`);
    console.log(
      r.detail
        .split("\n")
        .map((l) => "         " + l)
        .join("\n"),
    );
  }
}

console.log(
  `\n${results.length - failed}/${results.length} snippets compiled and ran` +
    (warned ? `, ${warned} with warnings` : "") +
    (failed ? `, ${failed} FAILED` : "") +
    ".",
);

if (failed || problems.length) process.exit(1);
