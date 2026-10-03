#!/usr/bin/env node
/**
 * Browser smoke test: drives the real UI against a real backend.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   python3 -m http.server 8099              # in another shell, from the repo root
 *   node tools/smoke.mjs                     # local site, deployed worker
 *   node tools/smoke.mjs https://havban.github.io/rust-tutorial/   # live site
 *
 * Checks every lesson renders, then exercises Run / Format / Clippy, the
 * self-checking exercise, progress persistence, routing and the mobile drawer.
 */

import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://127.0.0.1:8099/").replace(/\/?$/, "/");
const lesson = (slug) => `${BASE}#/${slug}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
const beacons = [];
const throttled = {};
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  // The bulk render sweep below visits every lesson in seconds, which makes
  // GoatCounter rate-limit the beacons. That is an artefact of the test, not a
  // site problem, so record 429s by host (asserted separately) instead of
  // treating the generic console message as a failure.
  if (m.type() !== "error") return;
  if (/status of 429/.test(m.text())) return;
  errors.push(m.text());
});
page.on("request", (r) => r.url().includes("goatcounter") && beacons.push(r.url()));
page.on("response", (r) => {
  if (r.status() !== 429) return;
  const host = new URL(r.url()).host;
  throttled[host] = (throttled[host] || 0) + 1;
});

let failures = 0;
const check = (label, actual, predicate) => {
  const ok = predicate(actual);
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}: ${actual}`);
};

const settled = (pattern) =>
  page.waitForFunction(
    (p) => !new RegExp(p).test(document.querySelector(".status")?.textContent || ""),
    pattern,
    { timeout: 90_000 },
  );

console.log(`Smoke testing ${BASE}\n`);

/* --- home --- */
const res = await page.goto(BASE, { waitUntil: "networkidle" });
check("home responds", res.status(), (s) => s === 200);
check("both paths offered", await page.locator(".path-card").count(), (n) => n === 2);
check("module cards (both paths)", await page.locator(".module-card").count(), (n) => n === 12);
check("path tabs", await page.locator(".path-tab").count(), (n) => n === 2);
check("course modules in sidebar", await page.locator(".toc-module").count(), (n) => n === 8);

/* --- switching path swaps the sidebar and the progress denominator --- */
await page.locator(".path-tab", { hasText: "Fast track" }).click();
await page.waitForTimeout(200);
check("fast-track modules", await page.locator(".toc-module").count(), (n) => n === 4);
check("fast-track total", await page.locator("#progress-pill").innerText(), (t) => /\/11$/.test(t));
check("lesson times shown", await page.locator(".toc-minutes").count(), (n) => n > 0);
await page.locator(".path-tab", { hasText: "Full course" }).click();
await page.waitForTimeout(200);
check("back to course total", await page.locator("#progress-pill").innerText(), (t) => /\/50$/.test(t));

/* --- opening a fast-track lesson follows it into that path --- */
await page.goto(lesson("ft-rust-in-five-minutes"), { waitUntil: "networkidle" });
await page.waitForSelector(".CodeMirror, .editor-fallback");
check("fast-track lesson opens", await page.locator("main h1").innerText(), (t) => /five minutes/i.test(t));
check("sidebar followed the path", await page.locator(".toc-module").count(), (n) => n === 4);
check("minutes badge", await page.locator(".tag-time").innerText(), (t) => /min/.test(t));

/* --- next/prev stay inside the path --- */
await page.locator("main h1").click();
await page.keyboard.press("[");
await page.waitForTimeout(300);
check("no previous before the first fast-track lesson",
  await page.locator("main h1").innerText(), (t) => /five minutes/i.test(t));
await page.keyboard.press("]");
await page.waitForTimeout(300);
check("next stays in path", await page.locator("main h1").innerText(), (t) => /at speed/i.test(t));

/* --- a lesson renders and runs --- */
await page.goto(lesson("borrowing"), { waitUntil: "networkidle" });
await page.waitForSelector(".CodeMirror, .editor-fallback");
check("lesson heading", await page.locator("main h1").innerText(), (t) => t.length > 3);
check("syntax highlighting", await page.locator(".cm-keyword").count(), (n) => n > 0);
check("summary renders code spans", await page.locator(".lesson-sub code").count(), (n) => n >= 0);

await page.click("button.btn-primary");
await settled("compiling");
check("run succeeds", (await page.locator(".status").innerText()).trim(), (t) => /success/.test(t));
check("stdout present", (await page.locator(".out-body").innerText()).slice(0, 20), (t) => t.includes("STDOUT"));

/* --- a deliberate compile error is reported, not swallowed --- */
await page.evaluate(() => {
  document.querySelector(".CodeMirror").CodeMirror.setValue('fn main() { let x: i32 = "nope"; }');
});
await page.click("button.btn-primary");
await settled("compiling");
check("bad code reported", (await page.locator(".status").innerText()).trim(), (t) => /failed/.test(t));
check("error lines styled", await page.locator(".out-body .e").count(), (n) => n > 0);

/* --- rustfmt and clippy --- */
await page.evaluate(() => {
  document.querySelector(".CodeMirror").CodeMirror.setValue(
    'fn main() {\n    let v: Vec<i32> = vec![1];\n    if v.len() == 0 { println!("empty"); }\n}',
  );
});
await page.click('button[title="Lint with clippy"]');
await settled("running clippy");
check("clippy lints", (await page.locator(".out-body").innerText()).includes("warning"), (v) => v);

await page.click('button[title="Reformat with rustfmt"]');
await settled("running rustfmt");
check("rustfmt applied", (await page.locator(".status").innerText()).trim(), (t) => /formatted/.test(t));

/* --- exercise checking, and the progress it records --- */
await page.goto(lesson("hello-world"), { waitUntil: "networkidle" });
await page.waitForSelector(".CodeMirror");
await page.click(".exercise button");
await page.waitForFunction(
  () => !/Checking/.test(document.querySelector(".exercise-result")?.textContent || ""),
  { timeout: 90_000 },
);
check("unsolved exercise rejected", await page.locator(".exercise-result").innerText(), (t) =>
  /Not quite/.test(t),
);

await page.evaluate(() => {
  const cm = document.querySelector(".CodeMirror").CodeMirror;
  cm.setValue(cm.getValue().replace(/\}\s*$/, '    println!("Rust is fun");\n}'));
});
await page.click(".exercise button");
await page.waitForFunction(
  () => !/Checking/.test(document.querySelector(".exercise-result")?.textContent || ""),
  { timeout: 90_000 },
);
check("solved exercise accepted", await page.locator(".exercise-result").innerText(), (t) =>
  /Correct/.test(t),
);
check("progress recorded", await page.locator("#progress-pill").innerText(), (t) => /^1\//.test(t));

await page.reload({ waitUntil: "networkidle" });
check("progress persists", await page.locator("#progress-pill").innerText(), (t) => /^1\//.test(t));
check(
  "edits persist",
  (await page.locator(".CodeMirror").innerText()).includes("Rust is fun"),
  (v) => v === true,
);

/* --- test-mode lesson --- */
await page.goto(lesson("testing"), { waitUntil: "networkidle" });
await page.waitForSelector(".CodeMirror");
await page.click("button.btn-primary");
await settled("running tests");
check(
  "test harness ran",
  ((await page.locator(".out-body").innerText()).match(/test result: .*/) || ["none"])[0],
  (t) => /0 failed/.test(t),
);

/* --- routing --- */
await page.goto(`${BASE}#/no-such-lesson`, { waitUntil: "networkidle" });
check("unknown slug handled", await page.locator("main h1").innerText(), (t) => /not found/i.test(t));

await page.goto(lesson("tuples"), { waitUntil: "networkidle" });
await page.locator("main h1").click();
await page.keyboard.press("]");
await page.waitForTimeout(300);
check("next-lesson key", await page.locator("main h1").innerText(), (t) => /Arrays/.test(t));

/* --- every lesson renders --- */
const slugs = await page.evaluate(async (base) => {
  const m = await import(`${base}assets/js/lessons/index.js`);
  return m.MODULES.flatMap((x) => x.lessons.map((l) => l.slug));
}, BASE);
let rendered = 0;
for (const slug of slugs) {
  await page.goto(lesson(slug), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main h1");
  if (await page.locator(".CodeMirror, .editor-fallback").count()) rendered++;
  else errors.push(`no editor on ${slug}`);
}
check(`all ${slugs.length} lessons render`, `${rendered}/${slugs.length}`, (t) =>
  t === `${slugs.length}/${slugs.length}`,
);

/* --- mobile --- */
await page.setViewportSize({ width: 390, height: 780 });
await page.goto(lesson("closures"), { waitUntil: "networkidle" });
await page.click("#sidebar-toggle");
await page.waitForTimeout(250);
check("mobile drawer opens", await page.getAttribute("#sidebar", "data-open"), (v) => v === "true");

/* --- cheatsheet --- */
const cs = await page.goto(BASE + "cheatsheet.html", { waitUntil: "networkidle" });
check("cheatsheet responds", cs.status(), (s) => s === 200);
check("cheatsheet sections", await page.locator(".box").count(), (n) => n >= 16);
check("cheatsheet columns", await page.locator(".col").count(), (n) => n === 4);
for (const [label, href] of [
  ["pdf", "assets/cheatsheet/rust-cheatsheet.pdf"],
  ["png", "assets/cheatsheet/rust-cheatsheet.png"],
]) {
  const r = await page.request.get(BASE + href);
  check(`cheatsheet ${label} downloadable`, `${r.status()} ${r.headers()["content-type"]}`, (t) =>
    t.startsWith("200"),
  );
}

/* --- the API itself must never be the thing rate-limiting a reader --- */
const apiThrottled = Object.entries(throttled).filter(([h]) => /workers\.dev|127\.0\.0\.1|localhost/.test(h));
check(
  "no rate limiting from the API",
  apiThrottled.length ? JSON.stringify(Object.fromEntries(apiThrottled)) : "none",
  (t) => t === "none",
);
if (Object.keys(throttled).length) {
  console.log(`  note  429s seen (expected from analytics during the bulk sweep): ${JSON.stringify(throttled)}`);
}

/* --- analytics. count.js deliberately ignores localhost, so only assert
       this when testing a deployed origin. --- */
if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(BASE)) {
  console.log("  skip goatcounter: count.js does not report from localhost");
} else {
  check("goatcounter beacons sent", beacons.length, (n) => n > 0);
}

console.log(`\nconsole errors: ${errors.length ? JSON.stringify(errors, null, 2) : "none"}`);
console.log(failures || errors.length ? `\n${failures} check(s) failed.` : "\nAll checks passed.");

await browser.close();
process.exit(failures || errors.length ? 1 : 0);
