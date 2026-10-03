#!/usr/bin/env node
/**
 * Renders cheatsheet.html to assets/cheatsheet/rust-cheatsheet.{pdf,png}.
 *
 * cheatsheet.html is the single source of truth; the PDF and PNG are generated
 * artefacts that happen to be committed, so people can download them straight
 * from the repo. Re-run this after editing the cheatsheet or its stylesheet.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   python3 -m http.server 8099      # in another shell, from the repo root
 *   node tools/build-cheatsheet.mjs
 */

import { chromium } from "playwright";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.BASE || "http://127.0.0.1:8099/").replace(/\/?$/, "/");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets", "cheatsheet");
const PDF = join(OUT, "rust-cheatsheet.pdf");
const PNG = join(OUT, "rust-cheatsheet.png");

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1680, height: 1200 },
  deviceScaleFactor: 2, // a crisp PNG, readable when zoomed
});

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const res = await page.goto(BASE + "cheatsheet.html", { waitUntil: "networkidle" });
if (!res.ok()) throw new Error(`cheatsheet.html returned HTTP ${res.status()}`);

// Sanity-check the content before committing an artefact built from it.
const boxes = await page.locator(".box").count();
const headings = await page.locator(".box h2").allInnerTexts();
if (boxes < 10) throw new Error(`only ${boxes} sections found — did the page render?`);

// Neutralise the on-screen chrome and framing for both artefacts.
await page.addStyleTag({
  content: `
    .screen-bar { display: none !important; }
    html, body { background: #fff !important; }
    /* Pin the export layout. page.pdf() lays out at the PDF page width, which
       is narrower than the browser viewport and would otherwise trip the
       responsive breakpoints down to three columns — making the sheet taller
       and spilling it onto a second page. */
    .sheet {
      width: 1600px !important;
      max-width: none !important;
      margin: 0 !important;
      box-shadow: none !important;
    }
    .cols { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
    /* The stylesheet's @page A3 rule is for printing from a browser; the
       downloadable PDF is one exact-fit page instead. */
    @page { size: auto; margin: 0; }
  `,
});
await page.waitForTimeout(200);

const sheet = await page.locator(".sheet").boundingBox();
if (!sheet) throw new Error("could not measure .sheet");

// page.pdf() emulates PRINT media by default, which would switch the layout and
// spill onto a second page. Force screen media so the PDF matches the PNG.
await page.emulateMedia({ media: "screen" });
await page.pdf({
  path: PDF,
  width: `${Math.ceil(sheet.width)}px`,
  height: `${Math.ceil(sheet.height) + 1}px`,
  printBackground: true,
  margin: { top: "0", bottom: "0", left: "0", right: "0" },
});
await page.emulateMedia({ media: null });

// PNG: the same sheet, at 2x for legibility when zoomed.
await page.locator(".sheet").screenshot({ path: PNG });

await browser.close();

const kb = (p) => `${Math.round(statSync(p).size / 1024)} KB`;
console.log(`${boxes} sections: ${headings.join(" · ")}`);
console.log(`PDF  ${PDF}  (${kb(PDF)})`);
console.log(`PNG  ${PNG}  (${kb(PNG)})`);
if (errors.length) {
  console.error("page errors:", errors);
  process.exit(1);
}
