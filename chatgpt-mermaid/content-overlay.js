(function (root) {
  "use strict";

  /**
   * Creates an overlay controller used by Mermaid diagrams for enlarged viewing.
   *
   * Invariants:
   * - Overlay DOM is created once per controller.
   * - Pan/zoom transform is applied only to the rendered SVG element.
   */
  function createMermaidOverlay(createActionButton) {
    const MIN_SCALE = 0.2;
    const MAX_SCALE = 5;

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
      scale: 1,
      tx: 0,
      ty: 0,
      pointerId: null,
      lastX: 0,
      lastY: 0
    };

    function getStageCenter() {
      const rect = stage.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    function applyTransform() {
      const svg = stage.querySelector("svg");
      if (!svg) return;
      svg.style.transformOrigin = "0 0";
      svg.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
      svg.style.cursor = state.pointerId === null ? "grab" : "grabbing";
    }

    function clampScale(nextScale) {
      return Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
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
      if (event.target === overlay) closeOverlay();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay.classList.contains("is-visible")) {
        closeOverlay();
      }
    });

    stage.addEventListener("pointerdown", (event) => {
      if (!stage.querySelector("svg")) return;
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
      const center = getStageCenter();
      zoomAt(center.x, center.y, 1.2);
    });

    zoomOutBtn.addEventListener("click", () => {
      const center = getStageCenter();
      zoomAt(center.x, center.y, 1 / 1.2);
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

  root.createMermaidOverlay = createMermaidOverlay;
})(typeof globalThis !== "undefined" ? globalThis : this);
