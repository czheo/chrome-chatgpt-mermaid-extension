(() => {
  "use strict";

  /**
   * Entry point for ChatGPT Mermaid enhancement.
   *
   * This file coordinates three concerns:
   * - scanning/instrumenting Mermaid code blocks
   * - rendering with retry patch support
   * - wiring UI state helpers and overlay helper modules
   */

  const MERMAID_SELECTOR = "code.language-mermaid";
  const PROCESSED_FLAG = "mmdEnhanced";
  const BUTTON_CLASS = "mmd-action-btn flex gap-1 items-center select-none py-1";

  const patchFlowchartLabelsForRetry =
    typeof globalThis.patchFlowchartLabelsForRetry === "function"
      ? globalThis.patchFlowchartLabelsForRetry
      : (codeText) => codeText;

  const createMermaidViewState =
    typeof globalThis.createMermaidViewState === "function"
      ? globalThis.createMermaidViewState
      : () => ({
          applyRenderResult: () => ({
            showingDiagram: true,
            renderButtonHidden: true,
            renderedControlsHidden: false,
            patchedCopyButtonHidden: true,
            patchedCode: ""
          }),
          showCode: () => ({
            showingDiagram: false,
            renderButtonHidden: false,
            renderedControlsHidden: true,
            patchedCopyButtonHidden: true,
            patchedCode: ""
          })
        });

  const createMermaidOverlay =
    typeof globalThis.createMermaidOverlay === "function"
      ? globalThis.createMermaidOverlay
      : null;

  if (typeof mermaid === "undefined") {
    return;
  }

  let initialized = false;
  let renderCounter = 0;

  function initMermaid() {
    if (initialized) return;

    const root = document.documentElement;
    const isDark = root.classList.contains("dark") || root.getAttribute("data-theme") === "dark";

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: isDark ? "dark" : "default"
    });

    initialized = true;
  }

  function createActionButton(text, ariaLabel = text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = text;
    button.setAttribute("aria-label", ariaLabel);
    return button;
  }

  function getCodeText(codeNode) {
    return (codeNode.textContent || "").trim();
  }

  async function renderDiagram(diagramWrap, codeText) {
    if (diagramWrap.dataset.rendered === "true") {
      const usedPatchedCode = diagramWrap.dataset.usedPatchedCode === "true";
      return {
        rendered: true,
        usedPatchedCode,
        patchedCode: usedPatchedCode ? diagramWrap.dataset.patchedCode || "" : ""
      };
    }

    initMermaid();
    renderCounter += 1;
    const id = `mmd-render-${Date.now()}-${renderCounter}`;

    try {
      const result = await mermaid.render(id, codeText);
      diagramWrap.innerHTML = result.svg;
      if (typeof result.bindFunctions === "function") {
        result.bindFunctions(diagramWrap);
      }
      diagramWrap.dataset.rendered = "true";
      diagramWrap.dataset.usedPatchedCode = "false";
      delete diagramWrap.dataset.patchedCode;
      return { rendered: true, usedPatchedCode: false, patchedCode: "" };
    } catch (err) {
      const patchedCode = patchFlowchartLabelsForRetry(codeText);
      let retryMessage = "";

      if (patchedCode && patchedCode !== codeText) {
        try {
          const retryResult = await mermaid.render(`${id}-retry`, patchedCode);
          diagramWrap.innerHTML = retryResult.svg;
          if (typeof retryResult.bindFunctions === "function") {
            retryResult.bindFunctions(diagramWrap);
          }
          diagramWrap.dataset.rendered = "true";
          diagramWrap.dataset.usedPatchedCode = "true";
          diagramWrap.dataset.patchedCode = patchedCode;
          return { rendered: true, usedPatchedCode: true, patchedCode };
        } catch (retryErr) {
          retryMessage = retryErr && retryErr.message ? retryErr.message : String(retryErr);
        }
      }

      const message = err && err.message ? err.message : String(err);
      const combinedMessage = retryMessage
        ? `${message}\n\nRetry (patched labels) also failed:\n${retryMessage}`
        : message;
      diagramWrap.innerHTML = `<div class="mmd-render-error">Mermaid render failed:\n${combinedMessage}</div>`;
      diagramWrap.dataset.rendered = "true";
      diagramWrap.dataset.usedPatchedCode = "false";
      delete diagramWrap.dataset.patchedCode;
      return { rendered: false, usedPatchedCode: false, patchedCode: "" };
    }
  }

  function applyViewState({ codeContainer, diagramWrap, renderButton, renderedControls, patchedCopyButton }, view) {
    if (view.showingDiagram) {
      codeContainer.style.display = "none";
      diagramWrap.classList.add("is-visible");
    } else {
      diagramWrap.classList.remove("is-visible");
      codeContainer.style.display = "";
    }

    renderButton.hidden = view.renderButtonHidden;
    renderedControls.hidden = view.renderedControlsHidden;
    patchedCopyButton.hidden = view.patchedCopyButtonHidden;
    patchedCopyButton.dataset.patchedCode = view.patchedCode || "";
  }

  function enhanceMermaidCode(codeNode) {
    if (!(codeNode instanceof HTMLElement) || codeNode.dataset[PROCESSED_FLAG] === "true") {
      return;
    }

    const codeContainer = codeNode.closest("div.overflow-y-auto") || codeNode.parentElement;
    if (!codeContainer) return;

    const diagramWrap = document.createElement("div");
    diagramWrap.className = "mmd-diagram-wrap";
    diagramWrap.dataset.rendered = "false";
    codeContainer.insertAdjacentElement("afterend", diagramWrap);

    const controlsContainer = document.createElement("div");
    controlsContainer.className = "mmd-controls-wrap";

    const renderButton = createActionButton("Render diagram", "Render Mermaid diagram");
    const showCodeButton = createActionButton("Show code", "Show Mermaid source code");
    const enlargeButton = createActionButton("Enlarge", "Open enlarged Mermaid diagram");
    const patchedCopyButton = createActionButton(
      "Copy patched code",
      "Copy Mermaid code after retry patch"
    );

    const renderedControls = document.createElement("div");
    renderedControls.className = "mmd-rendered-controls";
    renderedControls.appendChild(showCodeButton);
    renderedControls.appendChild(enlargeButton);
    renderedControls.appendChild(patchedCopyButton);

    controlsContainer.appendChild(renderButton);
    controlsContainer.appendChild(renderedControls);
    diagramWrap.insertAdjacentElement("afterend", controlsContainer);

    const viewState = createMermaidViewState();
    applyViewState(
      { codeContainer, diagramWrap, renderButton, renderedControls, patchedCopyButton },
      viewState.showCode()
    );

    let overlayController = null;

    renderButton.addEventListener("click", async () => {
      const codeText = getCodeText(codeNode);
      if (!codeText) return;
      const renderResult = await renderDiagram(diagramWrap, codeText);
      applyViewState(
        { codeContainer, diagramWrap, renderButton, renderedControls, patchedCopyButton },
        viewState.applyRenderResult(renderResult)
      );
    });

    showCodeButton.addEventListener("click", () => {
      applyViewState(
        { codeContainer, diagramWrap, renderButton, renderedControls, patchedCopyButton },
        viewState.showCode()
      );
    });

    enlargeButton.addEventListener("click", () => {
      const svg = diagramWrap.querySelector("svg");
      if (!svg || !createMermaidOverlay) return;
      if (!overlayController) {
        overlayController = createMermaidOverlay(createActionButton);
      }
      overlayController.open(svg.outerHTML);
    });

    patchedCopyButton.addEventListener("click", async () => {
      const patchedCode = patchedCopyButton.dataset.patchedCode || "";
      if (!patchedCode) return;

      try {
        await navigator.clipboard.writeText(patchedCode);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = patchedCode;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
    });

    codeNode.dataset[PROCESSED_FLAG] = "true";
  }

  function scan() {
    document.querySelectorAll(MERMAID_SELECTOR).forEach(enhanceMermaidCode);
  }

  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
