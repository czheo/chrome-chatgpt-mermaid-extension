import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loadMermaidCases } from "../helpers/examples.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const { patchFlowchartLabelsForRetry } = require(path.join(rootDir, "chatgpt-mermaid", "mermaid-patch.js"));

function applyVariantInput(code, variant) {
  if (variant === "crlf") {
    return `${code}\n`.replace(/\n/g, "\r\n");
  }

  return code;
}

test("runs mermaid patch cases from examples.md spec", async (t) => {
  const cases = await loadMermaidCases(rootDir);
  assert.ok(cases.length > 0, "expected at least one case in examples.md");

  for (const testCase of cases) {
    await t.test(testCase.name, () => {
      const input = applyVariantInput(testCase.code, testCase.variant);
      const output = patchFlowchartLabelsForRetry(input);

      if (testCase.expectation === "patched") {
        assert.notEqual(output, input, "expected case to be patched");
      } else {
        assert.equal(output, input, "expected case to remain unchanged");
      }

      for (const text of testCase.mustContain) {
        assert.ok(output.includes(text), `expected output to include: ${text}`);
      }

      for (const text of testCase.mustNotContain) {
        assert.ok(!output.includes(text), `expected output to exclude: ${text}`);
      }
    });
  }
});
