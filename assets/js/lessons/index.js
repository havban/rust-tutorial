import foundations from "./01-foundations.js";
import dataAndFlow from "./02-data-and-flow.js";
import ownership from "./03-ownership.js";
import structsEnums from "./04-structs-enums.js";
import collectionsErrors from "./05-collections-errors.js";
import genericsTraits from "./06-generics-traits.js";
import closuresIterators from "./07-closures-iterators.js";
import concurrencyAdvanced from "./08-concurrency-advanced.js";

/**
 * Ordered curriculum. Each module is { id, n, title, summary, lessons[] }, and
 * each lesson is { slug, title, summary, tags[], body, code, tests?, exercise? }.
 * Slugs are permanent — they are the URL fragment and the localStorage key.
 */
export const MODULES = [
  foundations,
  dataAndFlow,
  ownership,
  structsEnums,
  collectionsErrors,
  genericsTraits,
  closuresIterators,
  concurrencyAdvanced,
];

export default MODULES;
