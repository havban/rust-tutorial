/**
 * Thin wrapper over CodeMirror 5 that degrades to a <textarea> if the CDN
 * script never arrived, so a lesson stays runnable without it.
 */
export function createEditor(mount, { value, onRun }) {
  if (typeof window.CodeMirror === "function") {
    const cm = window.CodeMirror(mount, {
      value,
      mode: "rust",
      theme: "rt",
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      autoCloseBrackets: true,
      matchBrackets: true,
      viewportMargin: Infinity,
      extraKeys: {
        "Ctrl-Enter": onRun,
        "Cmd-Enter": onRun,
        "Ctrl-/": "toggleComment",
        "Cmd-/": "toggleComment",
        Tab: (ed) =>
          ed.somethingSelected()
            ? ed.indentSelection("add")
            : ed.replaceSelection("    "),
      },
    });
    return {
      getValue: () => cm.getValue(),
      setValue: (v) => cm.setValue(v),
      focus: () => cm.focus(),
      refresh: () => cm.refresh(),
    };
  }

  const ta = document.createElement("textarea");
  ta.className = "editor-fallback";
  ta.spellcheck = false;
  ta.value = value;
  ta.setAttribute("aria-label", "Rust code editor");
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onRun();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      ta.value = ta.value.slice(0, start) + "    " + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + 4;
    }
  });
  mount.appendChild(ta);
  return {
    getValue: () => ta.value,
    setValue: (v) => {
      ta.value = v;
    },
    focus: () => ta.focus(),
    refresh: () => {},
  };
}
