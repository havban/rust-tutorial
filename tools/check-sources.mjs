#!/usr/bin/env node
/**
 * Guards the one authoring trap in this repo: a backtick inside a lesson's
 * `code:` template literal silently ends the JS string, and the parse error
 * surfaces hundreds of lines later pointing at innocent Rust.
 *
 * This scans the lesson files as *text* — before any import — and reports the
 * exact line where a literal closed early. Run it first; it is instant.
 *
 *   node tools/check-sources.mjs
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LESSON_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "js", "lessons");
const MARKER = "code: `";

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

let problems = 0;
let literals = 0;

for (const file of readdirSync(LESSON_DIR).filter((f) => f.endsWith(".js")).sort()) {
  const text = readFileSync(join(LESSON_DIR, file), "utf8");

  let from = 0;
  for (;;) {
    const start = text.indexOf(MARKER, from);
    if (start === -1) break;
    literals++;

    // Walk forward the way the JS parser does: a backslash escapes the next
    // character, so the first *unescaped* backtick is where the literal ends.
    let i = start + MARKER.length;
    for (; i < text.length; i++) {
      if (text[i] === "\\") {
        i++;
        continue;
      }
      if (text[i] === "`") break;
    }

    // A well-formed lesson closes with "`," — anything else means the literal
    // ended early, inside the Rust source.
    const after = text.slice(i + 1).match(/^\s*(.)/);
    if (!after || after[1] !== ",") {
      problems++;
      console.error(
        `${file}:${lineOf(text, i)}  code literal ends here, but the next ` +
          `character is ${JSON.stringify(after?.[1] ?? "EOF")} rather than ",".\n` +
          `    An unescaped backtick in the Rust source closed it early — write it as \\\`.\n` +
          `    (literal opened at ${file}:${lineOf(text, start)})`,
      );
    }
    from = i + 1;
  }
}

if (problems) {
  console.error(`\n${problems} malformed code literal(s).`);
  process.exit(1);
}
console.log(`Lesson sources OK — ${literals} code literals, all properly terminated.`);
