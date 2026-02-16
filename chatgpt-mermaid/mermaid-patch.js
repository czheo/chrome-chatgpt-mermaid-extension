(function (root) {
  // If Node[...] contains invalid chars, Mermaid render may fail.
  // Patch such labels to Node["..."] in retry mode.
  function patchFlowchartLabelsForRetry(codeText) {
    return codeText.replace(/(\b[A-Za-z0-9_][A-Za-z0-9_-]*)\[([\s\S]*?)\]/g, (match, nodeId, labelText) => {
      const trimmed = labelText.trim();
      const isAlreadyQuoted =
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"));

      if (isAlreadyQuoted) {
        return match;
      }

      const isSafeUnquotedLabel = /^[A-Za-z _]+$/.test(labelText);
      if (isSafeUnquotedLabel) {
        return match;
      }

      return `${nodeId}["${labelText.replace(/"/g, '\\"')}"]`;
    });
  }

  root.patchFlowchartLabelsForRetry = patchFlowchartLabelsForRetry;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { patchFlowchartLabelsForRetry };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
