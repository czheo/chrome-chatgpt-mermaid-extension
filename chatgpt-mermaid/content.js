(() => {
  const MERMAID_SELECTOR = "code.language-mermaid";
  const PROCESSED_FLAG = "mmdEnhanced";
  const patchFlowchartLabelsForRetry =
    typeof globalThis.patchFlowchartLabelsForRetry === "function"
      ? globalThis.patchFlowchartLabelsForRetry
      : (codeText) => codeText;

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

  function getCodeText(codeNode) {
    return (codeNode.textContent || "").trim();
  }

  function createToggleButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mmd-toggle-btn flex gap-1 items-center select-none py-1";
    button.textContent = "Render diagram";
    button.setAttribute("aria-label", "Toggle Mermaid render");
    return button;
  }

  function findControlContainer(preNode) {
    const copyBtn = preNode.querySelector('button[aria-label="Copy"]');
    if (copyBtn && copyBtn.parentElement) {
      return copyBtn.parentElement;
    }

    return preNode.firstElementChild || preNode;
  }

  async function renderDiagram(diagramWrap, codeText) {
    if (diagramWrap.dataset.rendered === "true") {
      return;
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
    } catch (err) {
      // HACK: GPT often emits flowchart labels like [text<br/>(...)] that Mermaid may parse as invalid.
      // We retry once by quoting bracket-label contents in flowcharts to improve tolerance.
      const patchedCode = patchFlowchartLabelsForRetry(codeText);
      let retryMessage = "";
      if (patchedCode && patchedCode !== codeText) {
        try {
          const retryId = `${id}-retry`;
          const retryResult = await mermaid.render(retryId, patchedCode);
          diagramWrap.innerHTML = retryResult.svg;
          if (typeof retryResult.bindFunctions === "function") {
            retryResult.bindFunctions(diagramWrap);
          }
          diagramWrap.dataset.rendered = "true";
          return;
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
    }
  }

  function enhanceMermaidCode(codeNode) {
    if (!(codeNode instanceof HTMLElement) || codeNode.dataset[PROCESSED_FLAG] === "true") {
      return;
    }

    const preNode = codeNode.closest("pre");
    if (!preNode) {
      return;
    }

    const codeContainer = codeNode.closest("div.overflow-y-auto") || codeNode.parentElement;
    if (!codeContainer) {
      return;
    }

    const diagramWrap = document.createElement("div");
    diagramWrap.className = "mmd-diagram-wrap";
    diagramWrap.dataset.rendered = "false";

    codeContainer.insertAdjacentElement("afterend", diagramWrap);

    const toggleButton = createToggleButton();
    const controlsContainer = findControlContainer(preNode);
    controlsContainer.appendChild(toggleButton);

    let showingDiagram = false;

    toggleButton.addEventListener("click", async () => {
      const codeText = getCodeText(codeNode);
      if (!codeText) {
        return;
      }

      if (!showingDiagram) {
        await renderDiagram(diagramWrap, codeText);
        codeContainer.style.display = "none";
        diagramWrap.classList.add("is-visible");
        toggleButton.textContent = "Show code";
      } else {
        diagramWrap.classList.remove("is-visible");
        codeContainer.style.display = "";
        toggleButton.textContent = "Render diagram";
      }

      showingDiagram = !showingDiagram;
    });

    codeNode.dataset[PROCESSED_FLAG] = "true";
  }

  function scan() {
    const nodes = document.querySelectorAll(MERMAID_SELECTOR);
    nodes.forEach(enhanceMermaidCode);
  }

  scan();

  const observer = new MutationObserver(() => {
    scan();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
