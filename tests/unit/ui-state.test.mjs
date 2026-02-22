import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const { createMermaidViewState } = require(path.join(rootDir, "chatgpt-mermaid", "ui-state.js"));

test("ui state starts in code-visible mode", () => {
  const state = createMermaidViewState();
  const view = state.snapshot();

  assert.equal(view.showingDiagram, false);
  assert.equal(view.renderButtonHidden, false);
  assert.equal(view.renderedControlsHidden, true);
  assert.equal(view.patchedCopyButtonHidden, true);
  assert.equal(view.patchedCode, "");
});

test("applyRenderResult shows diagram and patched button only when retry patch is used", () => {
  const state = createMermaidViewState();

  const normal = state.applyRenderResult({ rendered: true, usedPatchedCode: false, patchedCode: "" });
  assert.equal(normal.showingDiagram, true);
  assert.equal(normal.renderButtonHidden, true);
  assert.equal(normal.renderedControlsHidden, false);
  assert.equal(normal.patchedCopyButtonHidden, true);

  const patched = state.applyRenderResult({
    rendered: true,
    usedPatchedCode: true,
    patchedCode: "flowchart TD\nA[\"x&lt;y\"]"
  });
  assert.equal(patched.patchedCopyButtonHidden, false);
  assert.equal(patched.patchedCode, "flowchart TD\nA[\"x&lt;y\"]");
});

test("showCode resets to code-visible mode and clears patched code", () => {
  const state = createMermaidViewState();
  state.applyRenderResult({ rendered: true, usedPatchedCode: true, patchedCode: "patched" });

  const view = state.showCode();
  assert.equal(view.showingDiagram, false);
  assert.equal(view.renderButtonHidden, false);
  assert.equal(view.renderedControlsHidden, true);
  assert.equal(view.patchedCopyButtonHidden, true);
  assert.equal(view.patchedCode, "");
});
