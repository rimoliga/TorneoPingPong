const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function collectIdsFromScript(scriptContent) {
  const idRegex = /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
  const ids = new Set();
  let match;
  while ((match = idRegex.exec(scriptContent)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

function collectIdsFromHtml(htmlContent) {
  const idRegex = /\sid=["']([^"']+)["']/g;
  const ids = new Set();
  let match;
  while ((match = idRegex.exec(htmlContent)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

test("todos los IDs usados por script.js existen en index.html", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const scriptContent = fs.readFileSync(
    path.join(projectRoot, "script.js"),
    "utf8"
  );
  const htmlContent = fs.readFileSync(
    path.join(projectRoot, "index.html"),
    "utf8"
  );

  const usedIds = collectIdsFromScript(scriptContent);
  const htmlIds = collectIdsFromHtml(htmlContent);
  const missing = [...usedIds].filter((id) => !htmlIds.has(id)).sort();

  assert.deepEqual(
    missing,
    [],
    `IDs faltantes en index.html (referenciados por script.js): ${missing.join(
      ", "
    )}`
  );
});
