((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.LerndeckFeedbackText = api;
})(typeof globalThis === "object" ? globalThis : this, () => {
  // Only explicit language references, never Markdown/HTML or guessed words.
  // Quotation marks keep older logged feedback readable without a migration.
  function parts(value) {
    const text = typeof value === "string" ? value : "";
    const pattern = /`([^`\r\n]+)`|„([^„“\r\n]+)“|“([^“”\r\n]+)”|"([^"\r\n]+)"/gu;
    const result = [];
    let end = 0;
    for (const match of text.matchAll(pattern)) {
      const form = match.slice(1).find(value => value !== undefined);
      if (!form.trim() || form.length > 100 || /[<>]/u.test(form)
        || !/[\p{L}\p{N}]/u.test(form) || form.trim().split(/\s+/u).length > 12) continue;
      if (match.index > end) result.push({ text: text.slice(end, match.index), reference: false });
      result.push({ text: form, reference: true });
      end = match.index + match[0].length;
    }
    if (end < text.length) result.push({ text: text.slice(end), reference: false });
    return result;
  }

  function plain(value) { return parts(value).map(part => part.text).join(""); }

  function append(element, value) {
    for (const part of parts(value)) {
      const node = part.reference ? element.ownerDocument.createElement("i") : element.ownerDocument.createTextNode(part.text);
      if (part.reference) {
        node.className = "sentence-stage__language-form";
        node.textContent = part.text;
      }
      element.append(node);
    }
  }

  return { parts, plain, append };
});
