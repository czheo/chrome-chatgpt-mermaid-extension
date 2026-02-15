# ChatGPT Mermaid Toggle Extension

## Quick Start

1. Open Chrome extensions page: `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select folder: `chrome-chatgpt-mermaid-extension/chatgpt-mermaid`
5. Open ChatGPT and click `Render diagram` on Mermaid code blocks

No build step is required.

## For Dev

Development flow:
- Edit files directly in `chatgpt-mermaid/`
- In `chrome://extensions`, click **Reload** for this extension
- Refresh ChatGPT page

### Tests

```bash
cd chrome-chatgpt-mermaid-extension
npm test
```

Tests live in `tests/`:
- `tests/unit/`: unit tests for Mermaid patch behavior using `examples.md`-style fixtures.
- `tests/e2e/`: HTML fixture flow tests (extract Mermaid blocks from ChatGPT-like HTML and apply patch logic).

## Structure

```text
chrome-chatgpt-mermaid-extension/
  chatgpt-mermaid/   # extension folder loaded directly by Chrome
  tests/             # test files
```
