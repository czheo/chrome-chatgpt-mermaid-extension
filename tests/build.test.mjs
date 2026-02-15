import test from "node:test";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const expectedExtensionFiles = [
  "manifest.json",
  "content.js",
  "content.css",
  "mermaid.min.js",
  "mermaid-patch.js"
];

test("chatgpt-mermaid folder contains required extension files", async () => {
  for (const file of expectedExtensionFiles) {
    const filePath = path.join(rootDir, "chatgpt-mermaid", file);
    await access(filePath);
  }
});
