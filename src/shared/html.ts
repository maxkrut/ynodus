export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char,
  );
}

export function renderTextParagraphs(value: string): string {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`).join("");
}
