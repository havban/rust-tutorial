/**
 * A deliberately small Markdown subset renderer — enough for lesson prose
 * (headings, lists, tables, fenced code, blockquotes, inline formatting) with
 * no third-party dependency. Lesson content is authored in this repo, but
 * everything is HTML-escaped before any formatting is applied anyway.
 */

const FENCE_OPEN = "␃FENCE";
const FENCE_CLOSE = "␃";

const escapeHtml = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    );
}

/**
 * Inline formatting only (code spans, bold, italics, links) with no block
 * structure — for one-line text such as a lesson summary.
 */
export function renderInline(text) {
  return inline(escapeHtml(text));
}

export function renderMarkdown(src) {
  const fences = [];
  // Pull fenced blocks out first so their contents never hit the inline rules.
  let text = src.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, body) => {
    fences.push(
      `<pre><code class="lang-${lang || "text"}">${escapeHtml(
        body.replace(/\n$/, ""),
      )}</code></pre>`,
    );
    return FENCE_OPEN + (fences.length - 1) + FENCE_CLOSE;
  });

  text = escapeHtml(text);

  const fenceLine = new RegExp(`^${FENCE_OPEN}(\\d+)${FENCE_CLOSE}$`);
  const lines = text.split("\n");
  const out = [];
  let i = 0;

  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const cells = (l) =>
    l
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = line.match(fenceLine);
    if (fence) {
      out.push(fences[Number(fence[1])]);
      i++;
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    if (/^&gt;\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^&gt;\s?/, ""));
        i++;
      }
      out.push(`<blockquote><p>${inline(body.join(" "))}</p></blockquote>`);
      continue;
    }

    if (isTableRow(line) && isTableRow(lines[i + 1] || "")) {
      const head = cells(line);
      i += 2; // skip the |---|---| separator row
      const body = [];
      while (i < lines.length && isTableRow(lines[i])) {
        body.push(cells(lines[i]));
        i++;
      }
      out.push(
        `<table><thead><tr>${head
          .map((c) => `<th>${inline(c)}</th>`)
          .join("")}</tr></thead><tbody>${body
          .map(
            (row) =>
              `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody></table>`,
      );
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{2,4}\s|\s*[-*]\s|\s*\d+\.\s|&gt;\s?)/.test(lines[i]) &&
      !fenceLine.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}
