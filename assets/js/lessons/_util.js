/**
 * Lesson prose is written as a list of lines rather than one template literal,
 * so that Markdown inline code can use plain backticks without escaping.
 * Rust snippets live in `code:` template literals instead — Rust source never
 * contains a backtick, but it is full of quotes.
 */
export const md = (...lines) => lines.join("\n");
