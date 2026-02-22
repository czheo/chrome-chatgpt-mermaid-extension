(function (root) {
  "use strict";

  /**
   * Retry-only Mermaid flowchart label patcher.
   *
   * Purpose:
   * - Mermaid flowcharts sometimes fail when node labels contain HTML-ish tokens
   *   or punctuation in unquoted bracket syntax (e.g. A[text<br/>x=y]).
   * - This helper rewrites only label text to a safer quoted form.
   *
   * Guardrails:
   * - Applies only to `flowchart`/`graph` diagrams.
   * - Returns original input when no change is required.
   * - Preserves structural delimiters and tries to avoid edge-label contexts.
   */

  function isFlowchartLikeDiagram(codeText) {
    return /^\s*(?:flowchart|graph)\b/im.test(codeText);
  }

  function escapeMermaidSensitiveCharsPreservingBreaks(text) {
    const breakPlaceholders = [];
    const withBreakPlaceholders = text.replace(/<br\s*\/?>/gi, (match) => {
      const token = `__MMD_BR_${breakPlaceholders.length}__`;
      breakPlaceholders.push(match);
      return token;
    });

    let escaped = withBreakPlaceholders
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/=/g, "&equals;");

    for (let i = 0; i < breakPlaceholders.length; i += 1) {
      escaped = escaped.replace(`__MMD_BR_${i}__`, breakPlaceholders[i]);
    }

    return escaped;
  }

  function escapeQuotedLabelContent(text, quoteChar) {
    if (quoteChar === "'") {
      return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    }
    return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function maybePatchLabelText(labelText) {
    const trimmed = labelText.trim();
    const isAlreadyQuoted =
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"));

    if (isAlreadyQuoted) {
      const quoteChar = trimmed[0];
      const inner = trimmed.slice(1, -1);
      const escapedInner = escapeMermaidSensitiveCharsPreservingBreaks(inner);
      if (escapedInner === inner) {
        return null;
      }

      const leading = labelText.slice(0, labelText.indexOf(trimmed));
      const trailing = labelText.slice(labelText.indexOf(trimmed) + trimmed.length);
      return `${leading}${quoteChar}${escapeQuotedLabelContent(escapedInner, quoteChar)}${quoteChar}${trailing}`;
    }

    const escapedLabelText = escapeMermaidSensitiveCharsPreservingBreaks(labelText);
    const isSafeUnquotedLabel = /^[A-Za-z _]+$/.test(labelText);
    if (isSafeUnquotedLabel && escapedLabelText === labelText) {
      return null;
    }

    return `"${escapeQuotedLabelContent(escapedLabelText, '"')}"`;
  }

  function isNodeLikePrefix(codeText, bracketStart) {
    let i = bracketStart - 1;
    while (i >= 0 && /\s/.test(codeText[i])) {
      i -= 1;
    }
    if (i < 0) return false;

    // Skip common non-node contexts (edge labels, quoted fragments).
    if (codeText[i] === "|" || codeText[i] === '"') {
      return false;
    }

    const tokenEnd = i;
    while (i >= 0 && /[^\s;:,()[\]{}]/.test(codeText[i])) {
      i -= 1;
    }

    const token = codeText.slice(i + 1, tokenEnd + 1);
    return token ? /[A-Za-z0-9_.@-]/.test(token) : false;
  }

  function findClosingDelimiter(codeText, openIndex, openChar, closeChar) {
    let depth = 1;
    let inSingle = false;
    let inDouble = false;
    let escaped = false;

    for (let i = openIndex + 1; i < codeText.length; i += 1) {
      const ch = codeText[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (inSingle) {
        if (ch === "'") inSingle = false;
        continue;
      }

      if (inDouble) {
        if (ch === '"') inDouble = false;
        continue;
      }

      if (ch === "'") {
        inSingle = true;
        continue;
      }
      if (ch === '"') {
        inDouble = true;
        continue;
      }

      if (ch === openChar) {
        depth += 1;
        continue;
      }

      if (ch === closeChar) {
        depth -= 1;
        if (depth === 0) return i;
      }
    }

    return -1;
  }

  function findNextLabelDelimiter(codeText, fromIndex) {
    const squareIndex = codeText.indexOf("[", fromIndex);
    const curlyIndex = codeText.indexOf("{", fromIndex);
    const roundIndex = codeText.indexOf("(", fromIndex);

    let next = -1;
    if (squareIndex !== -1) next = squareIndex;
    if (curlyIndex !== -1 && (next === -1 || curlyIndex < next)) next = curlyIndex;
    if (roundIndex !== -1 && (next === -1 || roundIndex < next)) next = roundIndex;
    return next;
  }

  function maybePatchParentheticalLabelText(labelText) {
    // Preserve nested wrapper syntax while patching only user-facing label content.
    if (labelText.startsWith("[") && labelText.endsWith("]")) {
      const innerLabel = labelText.slice(1, -1);
      const patchedInner = maybePatchLabelText(innerLabel);
      return patchedInner === null ? null : `[${patchedInner}]`;
    }

    if (labelText.startsWith("{") && labelText.endsWith("}")) {
      const innerLabel = labelText.slice(1, -1);
      const patchedInner = maybePatchLabelText(innerLabel);
      return patchedInner === null ? null : `{${patchedInner}}`;
    }

    if (labelText.startsWith("(") && labelText.endsWith(")")) {
      const innerLabel = labelText.slice(1, -1);
      const patchedInner = maybePatchLabelText(innerLabel);
      return patchedInner === null ? null : `(${patchedInner})`;
    }

    return maybePatchLabelText(labelText);
  }

  function patchFlowchartLabelsForRetry(codeText) {
    if (!isFlowchartLikeDiagram(codeText)) {
      return codeText;
    }

    let out = "";
    let cursor = 0;
    let changed = false;

    while (cursor < codeText.length) {
      const openIndex = findNextLabelDelimiter(codeText, cursor);
      if (openIndex === -1) {
        out += codeText.slice(cursor);
        break;
      }

      if (!isNodeLikePrefix(codeText, openIndex)) {
        out += codeText.slice(cursor, openIndex + 1);
        cursor = openIndex + 1;
        continue;
      }

      const openChar = codeText[openIndex];
      const closeChar = openChar === "[" ? "]" : openChar === "{" ? "}" : ")";
      const closeIndex = findClosingDelimiter(codeText, openIndex, openChar, closeChar);
      if (closeIndex === -1) {
        out += codeText.slice(cursor);
        break;
      }

      out += codeText.slice(cursor, openIndex + 1);

      const labelText = codeText.slice(openIndex + 1, closeIndex);
      const patchedLabel =
        openChar === "(" ? maybePatchParentheticalLabelText(labelText) : maybePatchLabelText(labelText);

      if (patchedLabel === null) {
        out += labelText;
      } else {
        out += patchedLabel;
        changed = true;
      }

      out += closeChar;
      cursor = closeIndex + 1;
    }

    return changed ? out : codeText;
  }

  root.patchFlowchartLabelsForRetry = patchFlowchartLabelsForRetry;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { patchFlowchartLabelsForRetry };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
