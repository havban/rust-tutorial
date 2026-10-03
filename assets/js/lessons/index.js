import foundations from "./01-foundations.js";
import dataAndFlow from "./02-data-and-flow.js";
import ownership from "./03-ownership.js";
import structsEnums from "./04-structs-enums.js";
import collectionsErrors from "./05-collections-errors.js";
import genericsTraits from "./06-generics-traits.js";
import closuresIterators from "./07-closures-iterators.js";
import concurrencyAdvanced from "./08-concurrency-advanced.js";
import fastTrackModules from "./fast-track.js";

/**
 * Two learning paths over the same site.
 *
 *   course — 50 lessons, first principles, assumes nothing.
 *   fast   — 11 dense lessons, ~60 minutes, assumes you already ship software
 *            in another language and spends its budget on the model, the idioms
 *            and the judgement calls.
 *
 * A module is { id, n, path, title, summary, lessons[] }; a lesson is
 * { slug, title, summary, tags[], body, code, minutes?, tests?, exercise? }.
 * Slugs are permanent — they are the URL fragment and the localStorage key.
 */
export const PATHS = [
  {
    id: "course",
    title: "Full course",
    tagline: "From first principles",
    blurb:
      "Fifty lessons that assume nothing. Every concept is built up from the one before, with a runnable program and an exercise at each step.",
    audience: "New to Rust, or new to systems programming.",
    modules: [
      foundations,
      dataAndFlow,
      ownership,
      structsEnums,
      collectionsErrors,
      genericsTraits,
      closuresIterators,
      concurrencyAdvanced,
    ],
  },
  {
    id: "fast",
    title: "Fast track",
    tagline: "Rust in one hour",
    blurb:
      "Eleven dense lessons for people who already program. Skips the syntax tour and spends the hour on the ownership model, the idioms, the API conventions and the judgement calls that separate working Rust from Rust that fights you.",
    audience: "Experienced in another language, new to Rust.",
    modules: fastTrackModules,
  },
];

// Stamp each module with its path so a lesson can always find its way home.
for (const path of PATHS) {
  for (const mod of path.modules) mod.path = path.id;
}

export const PATH_BY_ID = new Map(PATHS.map((p) => [p.id, p]));

/** Every module across every path, in order. Used by the verification tools. */
export const MODULES = PATHS.flatMap((p) => p.modules);

/** Total minutes for a path, when its lessons carry an estimate. */
export const pathMinutes = (path) =>
  path.modules.reduce(
    (total, mod) => total + mod.lessons.reduce((t, l) => t + (l.minutes || 0), 0),
    0,
  );

export default PATHS;
