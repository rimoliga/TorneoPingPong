const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElementStub() {
  const classes = new Set(["hidden"]);
  return {
    textContent: "",
    innerHTML: "",
    value: "",
    style: {},
    className: "",
    classList: {
      add: (...names) => names.forEach((n) => classes.add(n)),
      remove: (...names) => names.forEach((n) => classes.delete(n)),
      contains: (name) => classes.has(name),
      replace: (oldName, newName) => {
        classes.delete(oldName);
        classes.add(newName);
      },
    },
  };
}

function loadFrontendContext() {
  const scriptPath = path.join(path.resolve(__dirname, ".."), "script.js");
  let source = fs.readFileSync(scriptPath, "utf8");
  source = source.replace(/^import .+;$/gm, "");
  source = source.replace(/\ninitApp\(\);\s*$/, "\n");
  source += `
window.__TEST_HOOKS__ = {
  setGameState: (state) => { gameState = state; },
  getGameState: () => gameState,
  setCurrentRoomId: (id) => { currentRoomId = id; },
  setLiveMatchIndices: (idx) => { liveMatchIndices = idx; },
  setCurrentIdentity: (name) => { currentUserIdentity = name; },
  getLastToast: () => window.__lastToast,
  getLastUpdatePayload: () => window.__lastUpdatePayload,
  clearLastUpdatePayload: () => { window.__lastUpdatePayload = null; }
};
`;

  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, createElementStub());
    return elements.get(id);
  };

  const localStorageMap = new Map();
  const context = {
    console,
    Math,
    Date,
    JSON,
    setTimeout: (fn) => {
      fn();
      return 0;
    },
    clearTimeout: () => {},
    navigator: { vibrate: () => {} },
    confetti: () => {},
    crypto: { randomUUID: () => "uuid-test" },
    localStorage: {
      getItem: (k) => (localStorageMap.has(k) ? localStorageMap.get(k) : null),
      setItem: (k, v) => localStorageMap.set(k, String(v)),
      removeItem: (k) => localStorageMap.delete(k),
    },
    document: {
      getElementById,
      fullscreenElement: null,
      documentElement: { requestFullscreen: async () => {} },
      exitFullscreen: async () => {},
      createElement: () => createElementStub(),
    },
    window: {},
    initializeApp: () => ({}),
    getAuth: () => ({ currentUser: { uid: "u1" } }),
    signInAnonymously: async () => {},
    getFirestore: () => ({}),
    doc: (...args) => ({ ref: args.join("/") }),
    setDoc: async () => {},
    updateDoc: async (_ref, payload) => {
      context.window.__lastUpdatePayload = payload;
    },
    onSnapshot: () => () => {},
    arrayUnion: (...values) => values,
  };
  context.window = context;
  context.window.DB_PATH_PREFIX = "tests/path";
  context.window.__lastToast = null;
  context.window.__lastUpdatePayload = null;

  vm.runInNewContext(source, context, { filename: "script.js" });
  context.window.showToast = (msg, type) => {
    context.window.__lastToast = { msg, type };
  };
  context.window.playSound = () => {};
  return context;
}

test("liveScore no permite bajar de 0", async () => {
  const ctx = loadFrontendContext();
  const hooks = ctx.window.__TEST_HOOKS__;
  hooks.setCurrentRoomId("ROOM1");
  hooks.setGameState({
    targetScore: 11,
    champion: null,
    rounds: [{ matches: [{ p1: "A", p2: "B", score1: 0, score2: 0, winner: null }] }],
    votes: {},
  });
  hooks.setLiveMatchIndices({ rIdx: 0, mIdx: 0 });

  await ctx.window.liveScore(1, -1);
  const payload = hooks.getLastUpdatePayload();
  assert.equal(payload.rounds[0].matches[0].score1, 0);
});

test("liveScore bloquea sumar puntos luego de condición de victoria sin finalizar", async () => {
  const ctx = loadFrontendContext();
  const hooks = ctx.window.__TEST_HOOKS__;
  hooks.setCurrentRoomId("ROOM1");
  hooks.setGameState({
    targetScore: 11,
    champion: null,
    rounds: [{ matches: [{ p1: "A", p2: "B", score1: 11, score2: 8, winner: null }] }],
    votes: {},
  });
  hooks.setLiveMatchIndices({ rIdx: 0, mIdx: 0 });
  hooks.clearLastUpdatePayload();

  await ctx.window.liveScore(1, +1);
  assert.equal(hooks.getLastUpdatePayload(), null);
});

test("finishMatch no debe finalizar partido sin puntaje mínimo objetivo", async () => {
  const ctx = loadFrontendContext();
  const hooks = ctx.window.__TEST_HOOKS__;
  hooks.setCurrentRoomId("ROOM1");
  hooks.setGameState({
    players: ["A", "B"],
    targetScore: 11,
    rounds: [{ matches: [{ p1: "A", p2: "B", score1: 1, score2: 0, winner: null }] }],
  });
  hooks.clearLastUpdatePayload();

  await ctx.window.finishMatch(0, 0);
  assert.equal(hooks.getLastUpdatePayload(), null);
});

test("finishMatch válido define ganador y campeón en final", async () => {
  const ctx = loadFrontendContext();
  const hooks = ctx.window.__TEST_HOOKS__;
  hooks.setCurrentRoomId("ROOM1");
  hooks.setGameState({
    players: ["A", "B"],
    targetScore: 11,
    rounds: [{ matches: [{ p1: "A", p2: "B", score1: 11, score2: 9, winner: null }] }],
  });

  await ctx.window.finishMatch(0, 0);
  const payload = hooks.getLastUpdatePayload();
  assert.equal(payload.rounds[0].matches[0].winner, "A");
  assert.equal(payload.champion, "A");
});

test("solo admin/creador puede iniciar torneo", async () => {
  const ctx = loadFrontendContext();
  const hooks = ctx.window.__TEST_HOOKS__;
  hooks.setCurrentRoomId("ROOM1");
  hooks.setCurrentIdentity("jugador-no-admin");
  hooks.setGameState({
    players: ["owner", "p2", "p3"],
    creator: "otro-uid",
    rounds: [],
  });
  hooks.clearLastUpdatePayload();

  await ctx.window.startTournament();
  assert.equal(hooks.getLastUpdatePayload(), null);
  assert.equal(
    hooks.getLastToast()?.msg,
    "Solo el creador/admin puede sortear equipos"
  );
});

test("permite votar el mismo partido en torneos distintos", async () => {
  const ctx = loadFrontendContext();
  const hooks = ctx.window.__TEST_HOOKS__;
  hooks.setCurrentRoomId("ROOM1");
  hooks.setCurrentIdentity("espectador");
  hooks.setGameState({
    activeSince: 111,
    createdAt: "2025-01-01T00:00:00.000Z",
    rounds: [{ matches: [{ p1: "A", p2: "B", score1: 0, score2: 0, winner: null }] }],
    votes: {},
  });

  await ctx.window.voteFor(0, 0, 1);
  const firstPayload = hooks.getLastUpdatePayload();
  assert.equal(firstPayload.votes["ROOM1_r0m0"].p1, 1);

  hooks.setGameState({
    activeSince: 222,
    createdAt: "2025-01-01T00:00:00.000Z",
    rounds: [{ matches: [{ p1: "A", p2: "B", score1: 0, score2: 0, winner: null }] }],
    votes: {},
  });
  hooks.clearLastUpdatePayload();

  await ctx.window.voteFor(0, 0, 1);
  const secondPayload = hooks.getLastUpdatePayload();
  assert.equal(secondPayload.votes["ROOM1_r0m0"].p1, 1);
});
