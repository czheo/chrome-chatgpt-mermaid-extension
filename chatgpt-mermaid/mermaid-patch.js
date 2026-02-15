(function (root) {
  function patchFlowchartLabelsForRetry(codeText) {
    if (!/^\s*flowchart\b/m.test(codeText)) {
      return codeText;
    }

    return codeText.replace(/\[([\s\S]*?)\]/g, (match, labelText) => {
      const trimmed = labelText.trim();
      const isAlreadyQuoted =
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"));

      if (isAlreadyQuoted) {
        return match;
      }

      const hasProblematicContinuation =
        /(?:<br\s*\/?>|\r?\n|\u2028|\u2029)\s*\(/.test(labelText);
      const hasParentheses = /[()]/.test(labelText);

      if (!hasProblematicContinuation && !hasParentheses) {
        return match;
      }

      return `["${labelText.replace(/"/g, '\\"')}"]`;
    });
  }

  root.patchFlowchartLabelsForRetry = patchFlowchartLabelsForRetry;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { patchFlowchartLabelsForRetry };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
