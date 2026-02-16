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
    button.className = "mmd-action-btn flex gap-1 items-center select-none py-1";
    button.textContent = "Render diagram";
    button.setAttribute("aria-label", "Render Mermaid diagram");
    return button;
  }

  function createActionButton(text, ariaLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mmd-action-btn flex gap-1 items-center select-none py-1";
    button.textContent = text;
    button.setAttribute("aria-label", ariaLabel || text);
    return button;
  }

  function createOverlayState() {
    const overlay = document.createElement("div");
    overlay.className = "mmd-overlay";
    overlay.setAttribute("aria-hidden", "true");

    const topbar = document.createElement("div");
    topbar.className = "mmd-overlay-topbar";

    const closeBtn = createActionButton("Close", "Close enlarged Mermaid diagram");
    closeBtn.classList.add("mmd-overlay-close");
    topbar.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "mmd-overlay-body";

    const stage = document.createElement("div");
    stage.className = "mmd-overlay-stage";
    body.appendChild(stage);

    const controls = document.createElement("div");
    controls.className = "mmd-overlay-controls";

    const zoomOutBtn = createActionButton("Zoom out", "Zoom out diagram");
    const zoomInBtn = createActionButton("Zoom in", "Zoom in diagram");
    const resetBtn = createActionButton("Reset", "Reset diagram view");
    controls.appendChild(zoomOutBtn);
    controls.appendChild(zoomInBtn);
    controls.appendChild(resetBtn);

    overlay.appendChild(topbar);
    overlay.appendChild(body);
    overlay.appendChild(controls);
    document.body.appendChild(overlay);

    const state = {
      overlay,
      stage,
      scale: 1,
      tx: 0,
      ty: 0,
      pointerId: null,
      lastX: 0,
      lastY: 0
    };

    function applyTransform() {
      const svg = stage.querySelector("svg");
      if (!svg) return;
      svg.style.transformOrigin = "0 0";
      svg.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
      svg.style.cursor = state.pointerId === null ? "grab" : "grabbing";
    }

    function clampScale(nextScale) {
      return Math.max(0.2, Math.min(5, nextScale));
    }

    function zoomAt(clientX, clientY, factor) {
      const rect = stage.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const nextScale = clampScale(state.scale * factor);
      const ratio = nextScale / state.scale;
      state.tx = px - (px - state.tx) * ratio;
      state.ty = py - (py - state.ty) * ratio;
      state.scale = nextScale;
      applyTransform();
    }

    function resetView() {
      state.scale = 1;
      state.tx = 0;
      state.ty = 0;
      applyTransform();
    }

    function closeOverlay() {
      overlay.classList.remove("is-visible");
      overlay.setAttribute("aria-hidden", "true");
      stage.innerHTML = "";
      document.body.classList.remove("mmd-overlay-open");
      state.pointerId = null;
    }

    closeBtn.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeOverlay();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay.classList.contains("is-visible")) {
        closeOverlay();
      }
    });

    stage.addEventListener("pointerdown", (event) => {
      const svg = stage.querySelector("svg");
      if (!svg) return;
      state.pointerId = event.pointerId;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      stage.setPointerCapture(event.pointerId);
      applyTransform();
      event.preventDefault();
    });

    stage.addEventListener("pointermove", (event) => {
      if (state.pointerId !== event.pointerId) return;
      const dx = event.clientX - state.lastX;
      const dy = event.clientY - state.lastY;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      state.tx += dx;
      state.ty += dy;
      applyTransform();
      event.preventDefault();
    });

    stage.addEventListener("pointerup", (event) => {
      if (state.pointerId !== event.pointerId) return;
      state.pointerId = null;
      stage.releasePointerCapture(event.pointerId);
      applyTransform();
    });

    stage.addEventListener("pointercancel", () => {
      state.pointerId = null;
      applyTransform();
    });

    stage.addEventListener(
      "wheel",
      (event) => {
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        zoomAt(event.clientX, event.clientY, factor);
        event.preventDefault();
      },
      { passive: false }
    );

    zoomInBtn.addEventListener("click", () => {
      const rect = stage.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.2);
    });

    zoomOutBtn.addEventListener("click", () => {
      const rect = stage.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.2);
    });

    resetBtn.addEventListener("click", resetView);

    return {
      open(svgMarkup) {
        stage.innerHTML = svgMarkup;
        resetView();
        overlay.classList.add("is-visible");
        overlay.setAttribute("aria-hidden", "false");
        document.body.classList.add("mmd-overlay-open");
      }
    };
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
      return {
        rendered: true,
        usedPatchedCode: false,
        patchedCode: ""
      };
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
          diagramWrap.dataset.usedPatchedCode = "true";
          diagramWrap.dataset.patchedCode = patchedCode;
          return {
            rendered: true,
            usedPatchedCode: true,
            patchedCode
          };
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
      return {
        rendered: false,
        usedPatchedCode: false,
        patchedCode: ""
      };
    }
  }

  function enhanceMermaidCode(codeNode) {
    if (!(codeNode instanceof HTMLElement) || codeNode.dataset[PROCESSED_FLAG] === "true") {
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

    const controlsContainer = document.createElement("div");
    controlsContainer.className = "mmd-controls-wrap";

    const renderButton = createToggleButton();
    const showCodeButton = createActionButton("Show code", "Show Mermaid source code");
    const enlargeButton = createActionButton("Enlarge", "Open enlarged Mermaid diagram");

    const renderedControls = document.createElement("div");
    renderedControls.className = "mmd-rendered-controls";
    renderedControls.appendChild(showCodeButton);
    renderedControls.appendChild(enlargeButton);
    const patchedCopyButton = createActionButton(
      "Copy patched code",
      "Copy Mermaid code after retry patch"
    );
    patchedCopyButton.hidden = true;
    renderedControls.appendChild(patchedCopyButton);
    renderedControls.hidden = true;

    controlsContainer.appendChild(renderButton);
    controlsContainer.appendChild(renderedControls);
    diagramWrap.insertAdjacentElement("afterend", controlsContainer);

    let showingDiagram = false;
    let overlayState = null;

    renderButton.addEventListener("click", async () => {
      const codeText = getCodeText(codeNode);
      if (!codeText) {
        return;
      }

      const renderResult = await renderDiagram(diagramWrap, codeText);
      codeContainer.style.display = "none";
      diagramWrap.classList.add("is-visible");
      renderButton.hidden = true;
      renderedControls.hidden = false;
      patchedCopyButton.hidden = !(
        renderResult &&
        renderResult.rendered &&
        renderResult.usedPatchedCode &&
        renderResult.patchedCode
      );
      patchedCopyButton.dataset.patchedCode = patchedCopyButton.hidden ? "" : renderResult.patchedCode;
      showingDiagram = true;
    });

    showCodeButton.addEventListener("click", () => {
      if (!showingDiagram) return;
      diagramWrap.classList.remove("is-visible");
      codeContainer.style.display = "";
      renderedControls.hidden = true;
      patchedCopyButton.hidden = true;
      renderButton.hidden = false;
      showingDiagram = false;
    });

    enlargeButton.addEventListener("click", () => {
      const svg = diagramWrap.querySelector("svg");
      if (!svg) return;
      if (!overlayState) {
        overlayState = createOverlayState();
      }
      overlayState.open(svg.outerHTML);
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
