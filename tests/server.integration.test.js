const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const net = require("node:net");
const { spawn } = require("node:child_process");
const path = require("node:path");

const SERVER_URL = "http://127.0.0.1:3000";
const SERVER_START_TIMEOUT_MS = 12000;

function request(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${SERVER_URL}${pathname}`, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
  });
}

function rawRequest(pathname) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: 3000 }, () => {
      socket.write(
        `GET ${pathname} HTTP/1.1\r\nHost: 127.0.0.1:3000\r\nConnection: close\r\n\r\n`
      );
    });

    let raw = "";
    socket.on("data", (chunk) => {
      raw += chunk.toString("utf8");
    });
    socket.on("error", reject);
    socket.on("end", () => {
      const [statusLine] = raw.split("\r\n");
      const match = statusLine.match(/^HTTP\/1\.[01]\s+(\d{3})/);
      resolve({ statusCode: match ? Number(match[1]) : null, raw });
    });
  });
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < SERVER_START_TIMEOUT_MS) {
    try {
      const res = await request("/");
      if (res.statusCode === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Server did not start in time");
}

let serverProcess;
let serverLogs = "";

test.before(async () => {
  const projectRoot = path.resolve(__dirname, "..");
  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      FIREBASE_API_KEY: "api-key-test",
      FIREBASE_AUTH_DOMAIN: "auth-domain-test",
      FIREBASE_PROJECT_ID: "project-id-test",
      FIREBASE_STORAGE_BUCKET: "storage-bucket-test",
      FIREBASE_MESSAGING_SENDER_ID: "messaging-id-test",
      FIREBASE_APP_ID: "app-id-test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", (d) => (serverLogs += d.toString("utf8")));
  serverProcess.stderr.on("data", (d) => (serverLogs += d.toString("utf8")));
  await waitForServer();
});

test.after(async () => {
  if (!serverProcess) return;
  serverProcess.kill("SIGTERM");
  await new Promise((resolve) => {
    serverProcess.once("exit", () => resolve());
    setTimeout(() => resolve(), 3000);
  });
});

test("GET / sirve HTML con placeholders reemplazados", async () => {
  const res = await request("/");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /text\/html/);
  assert.match(res.body, /api-key-test/);
  assert.doesNotMatch(res.body, /__API_KEY__/);
});

test("GET /script.js sirve el bundle del frontend", async () => {
  const res = await request("/script.js");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /text\/javascript/);
  assert.match(res.body, /window\.createRoom/);
});

test("GET de archivo inexistente devuelve 404", async () => {
  const res = await request("/no-existe-12345.txt");
  assert.equal(res.statusCode, 404);
  assert.match(res.body, /Not Found/);
});

test("bloquea path traversal con .. codificado", async () => {
  const res = await rawRequest("/%2e%2e/package.json");
  assert.equal(
    res.statusCode,
    404,
    `Se esperaba 404 para path traversal. Respuesta: ${res.statusCode}. Logs: ${serverLogs}`
  );
});
