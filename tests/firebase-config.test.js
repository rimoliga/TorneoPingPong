const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("index.html contiene placeholders firebase esperados", () => {
  const html = fs.readFileSync(
    path.join(path.resolve(__dirname, ".."), "index.html"),
    "utf8"
  );

  const placeholders = [
    "__API_KEY__",
    "__AUTH_DOMAIN__",
    "__PROJECT_ID__",
    "__STORAGE_BUCKET__",
    "__MESSAGING_SENDER_ID__",
    "__APP_ID__",
  ];

  for (const token of placeholders) {
    assert.match(html, new RegExp(token));
  }
});
