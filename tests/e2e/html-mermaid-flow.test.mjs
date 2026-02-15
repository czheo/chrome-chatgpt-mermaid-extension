import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const { patchFlowchartLabelsForRetry } = require(path.join(rootDir, "chatgpt-mermaid", "mermaid-patch.js"));

function decodeHtmlEntities(input) {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractMermaidCodeBlocksFromHtml(html) {
  const blocks = [];
  const regex = /<code[^>]*class="[^"]*language-mermaid[^"]*"[^>]*>([\s\S]*?)<\/code>/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const inner = match[1]
      .replace(/<span[^>]*>/g, "")
      .replace(/<\/span>/g, "")
      .trim();

    blocks.push(decodeHtmlEntities(inner));
  }

  return blocks;
}

test("extracts only Mermaid code blocks from html fixture", async () => {
  const html = await readFile(path.join(rootDir, "tests", "fixtures", "chatgpt-snippet.html"), "utf8");
  const blocks = extractMermaidCodeBlocksFromHtml(html);

  assert.equal(blocks.length, 2);
  assert.match(blocks[0], /^flowchart\s+LR/);
  assert.match(blocks[1], /^sequenceDiagram/);
});

test("html flow applies retry patch only to problematic block", async () => {
  const html = await readFile(path.join(rootDir, "tests", "fixtures", "chatgpt-snippet.html"), "utf8");
  const blocks = extractMermaidCodeBlocksFromHtml(html);

  const patchedFirst = patchFlowchartLabelsForRetry(blocks[0]);
  const patchedSecond = patchFlowchartLabelsForRetry(blocks[1]);

  assert.notEqual(patchedFirst, blocks[0]);
  assert.match(patchedFirst, /C\["Value<br\/>\(line two\)"\]/);

  assert.equal(patchedSecond, blocks[1]);
});
