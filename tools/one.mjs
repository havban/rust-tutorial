// Compile a single lesson and dump the full compiler output. Debug helper.
import { MODULES } from "../assets/js/lessons/index.js";
const slug = process.argv[2];
const l = MODULES.flatMap((m) => m.lessons).find((x) => x.slug === slug);
if (!l) throw new Error(`no lesson named ${slug}`);
const API = process.env.API || "https://rust-tutorial.hidayat-febiansyah.workers.dev";
const r = await fetch(`${API}/api/run`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: l.code, tests: l.tests === true, crateType: l.tests ? "lib" : "bin" }),
});
const d = await r.json();
console.log(d.stderr || d.error || "(no diagnostics)");
if (d.stdout) console.log("--- stdout ---\n" + d.stdout);
