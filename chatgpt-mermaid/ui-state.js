(function (root) {
  "use strict";

  /**
   * UI state model for a single Mermaid block.
   *
   * We keep this state logic separate from DOM wiring so it can be unit-tested
   * without a browser environment. The content script applies the returned
   * visibility flags to actual elements.
   */
  function createMermaidViewState() {
    const state = {
      showingDiagram: false,
      renderButtonHidden: false,
      renderedControlsHidden: true,
      patchedCopyButtonHidden: true,
      patchedCode: ""
    };

    function applyRenderResult(renderResult) {
      state.showingDiagram = true;
      state.renderButtonHidden = true;
      state.renderedControlsHidden = false;

      const hasPatchedCode = Boolean(
        renderResult &&
          renderResult.rendered &&
          renderResult.usedPatchedCode &&
          renderResult.patchedCode
      );

      state.patchedCopyButtonHidden = !hasPatchedCode;
      state.patchedCode = hasPatchedCode ? renderResult.patchedCode : "";
      return { ...state };
    }

    function showCode() {
      state.showingDiagram = false;
      state.renderButtonHidden = false;
      state.renderedControlsHidden = true;
      state.patchedCopyButtonHidden = true;
      state.patchedCode = "";
      return { ...state };
    }

    function snapshot() {
      return { ...state };
    }

    return {
      applyRenderResult,
      showCode,
      snapshot
    };
  }

  root.createMermaidViewState = createMermaidViewState;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createMermaidViewState };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
