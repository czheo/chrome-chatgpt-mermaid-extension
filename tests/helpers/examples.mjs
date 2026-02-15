import path from "node:path";
import { readFile } from "node:fs/promises";

const CASE_REGEX = /### Case:\s*(.+)\n```json\n([\s\S]*?)```\n```mermaid\n([\s\S]*?)```/g;

export async function loadMermaidCases(rootDir) {
  const markdown = await readFile(path.join(rootDir, "tests", "fixtures", "examples.md"), "utf8");
  return extractMermaidCases(markdown);
}

export function extractMermaidCases(markdown) {
  const cases = [];
  let match;

  while ((match = CASE_REGEX.exec(markdown)) !== null) {
    const name = match[1].trim();
    const specRaw = match[2].trim();
    const code = match[3].trim();
    let spec;

    try {
      spec = JSON.parse(specRaw);
    } catch (err) {
      throw new Error(`Invalid JSON spec for case \"${name}\": ${err.message}`);
    }

    if (!["patched", "unchanged"].includes(spec.expectation)) {
      throw new Error(`Invalid expectation for case \"${name}\": ${spec.expectation}`);
    }

    const variant = spec.variant || "normal";
    if (!["normal", "crlf"].includes(variant)) {
      throw new Error(`Invalid variant for case \"${name}\": ${variant}`);
    }

    cases.push({
      name,
      code,
      expectation: spec.expectation,
      variant,
      mustContain: spec.mustContain || [],
      mustNotContain: spec.mustNotContain || []
    });
  }

  return cases;
}
