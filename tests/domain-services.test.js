const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function importModule(relPath) {
  const abs = path.join(path.resolve(__dirname, ".."), relPath);
  return import(pathToFileURL(abs).href);
}

test("readyService normaliza y valida todos listos", async () => {
  const ready = await importModule("src/domain/readyService.js");
  const players = ["A", "B", "C"];
  const raw = { A: true, B: 1, X: true };

  const normalized = ready.normalizeReadyPlayers(players, raw);
  assert.deepEqual(normalized, { A: true, B: true, C: false });
  assert.equal(ready.countReadyPlayers(players, raw), 2);
  assert.equal(ready.areAllPlayersReady(players, raw), false);
  assert.equal(
    ready.areAllPlayersReady(players, { A: true, B: true, C: true }),
    true
  );
});

test("scoringService aplica reglas de victoria y ganador", async () => {
  const scoring = await importModule("src/domain/scoringService.js");
  assert.equal(scoring.isWinningState(11, 9, 11), true);
  assert.equal(scoring.isWinningState(11, 10, 11), false);
  assert.equal(scoring.canFinalizeMatch(12, 10, 11), true);
  assert.equal(scoring.canFinalizeMatch(10, 8, 11), false);
  assert.equal(scoring.getWinnerByScore("A", "B", 11, 9), "A");
  assert.equal(scoring.getWinnerByScore("A", "B", 7, 9), "B");
  assert.equal(scoring.getWinnerByScore("A", "B", 9, 9), null);
  assert.equal(
    scoring.getCloseMatchHint(9, 7, 11).text.includes("Faltan 2 punto(s)"),
    true
  );
  assert.equal(scoring.getCloseMatchHint(11, 9, 11).canClose, true);
});

test("roomController valida readiness y arma partidos", async () => {
  const room = await importModule("src/controllers/roomController.js");
  const players = ["A", "B", "C", "D"];
  const notReady = { A: true, B: false, C: true, D: true };
  const ready = { A: true, B: true, C: true, D: true };

  assert.equal(room.validateStartTournament(players, notReady).ok, false);
  assert.equal(room.validateStartTournament(players, ready).ok, true);

  const toggle = room.buildToggleReadyUpdate("A", { A: false });
  assert.equal(toggle.ok, true);
  assert.equal(toggle.nextReadyPlayers.A, true);

  const built = room.buildTournamentMatches(players, () => 0.9);
  assert.equal(built.ok, true);
  assert.equal(Array.isArray(built.matches), true);
  assert.equal(built.matches.length > 0, true);

  const confirmation = room.buildStartTournamentConfirmation(players, 11);
  assert.equal(typeof confirmation, "string");
  assert.equal(confirmation.includes("4 jugadores"), true);
  assert.equal(confirmation.includes("11 puntos"), true);
});

test("setupReadinessView renderiza contadores y estado de botones", async () => {
  const ui = await importModule("src/ui/components/setupReadinessView.js");
  const playerCountEl = { textContent: "" };
  const readyCountEl = { textContent: "" };
  const readyBtnEl = { textContent: "" };
  const startBtnEl = { disabled: true };

  ui.renderSetupReadiness({
    players: ["A", "B"],
    readyPlayers: { A: true, B: false },
    currentUserIdentity: "A",
    playerCountEl,
    readyCountEl,
    readyBtnEl,
    startBtnEl,
  });

  assert.equal(playerCountEl.textContent, "2 Jugadores");
  assert.equal(readyCountEl.textContent, "1/2 listos");
  assert.equal(readyBtnEl.textContent, "NO LISTO");
  assert.equal(startBtnEl.disabled, true);
});

test("identityService evalua stale claim y claim patch", async () => {
  const identity = await importModule("src/domain/identityService.js");
  const now = 200000;
  const claims = { A: "other-client" };
  const claimsMeta = { A: { clientUUID: "other-client", updatedAt: 1000 } };

  assert.equal(
    identity.isClaimStaleForPlayer("A", claims, claimsMeta, "me", 120000, now),
    true
  );
  assert.equal(
    identity.canUseStoredIdentity("A", ["A"], claims, claimsMeta, "me", 120000, now),
    true
  );

  const patch = identity.buildClaimPatch("A", "me", true, now);
  assert.equal(patch["claims.A"], "me");
  assert.equal(patch["claimsMeta.A"].updatedAt, now);
  assert.equal(patch["readyPlayers.A"], false);
});

test("votingService arma keys y acumula votos", async () => {
  const voting = await importModule("src/domain/votingService.js");
  const matchKey = voting.buildMatchKey("ROOM", 1, 2);
  const scope = voting.resolveVoteScope(123, "old");
  const localKey = voting.buildLocalVoteKey(matchKey, scope);

  assert.equal(matchKey, "ROOM_r1m2");
  assert.equal(localKey, "voted_ROOM_r1m2_123");
  assert.equal(
    voting.canPlayerVoteMatch({ p1: "A", p2: "B" }, "viewer"),
    true
  );
  assert.equal(
    voting.canPlayerVoteMatch({ p1: "A", p2: "B" }, "A"),
    false
  );

  const nextVotes = voting.buildNextVotes({}, matchKey, 2);
  assert.equal(nextVotes[matchKey].p1, 0);
  assert.equal(nextVotes[matchKey].p2, 1);
});

test("matchController genera final y tercer puesto desde semifinales", async () => {
  const matchController = await importModule("src/controllers/matchController.js");
  const rounds = [
    {
      matches: [
        { p1: "A", p2: "B", winner: "A" },
        { p1: "C", p2: "D", winner: "D" },
      ],
    },
  ];

  const result = matchController.applyRoundProgression(rounds, 4, 0);
  assert.equal(result.champion, null);
  assert.equal(result.rounds.length, 2);
  assert.equal(result.rounds[1].matches.length, 2);
  assert.equal(result.rounds[1].matches[0].p1, "A");
  assert.equal(result.rounds[1].matches[0].p2, "D");
  assert.equal(result.rounds[1].matches[1].isThirdPlace, true);
});

test("matchController define campeon en ronda final", async () => {
  const matchController = await importModule("src/controllers/matchController.js");
  const rounds = [
    {
      matches: [{ p1: "A", p2: "B", winner: "A" }],
    },
  ];
  const result = matchController.applyRoundProgression(rounds, 2, 0);
  assert.equal(result.champion, "A");
});

test("statsController calcula y ordena tabla", async () => {
  const statsController = await importModule("src/controllers/statsController.js");
  const players = ["A", "B", "C"];
  const rounds = [
    {
      matches: [
        { p1: "A", p2: "B", score1: 11, score2: 9, winner: "A", isBye: false },
        { p1: "C", p2: null, score1: 0, score2: 0, winner: "C", isBye: true },
      ],
    },
    {
      matches: [{ p1: "A", p2: "C", score1: 8, score2: 11, winner: "C", isBye: false }],
    },
  ];

  const sorted = statsController.calculateTournamentStats(players, rounds);
  assert.equal(sorted.length, 3);
  assert.equal(sorted[0].name, "C");
  assert.equal(sorted[0].won, 1);
  assert.equal(sorted[1].name, "A");
  assert.equal(sorted[1].played, 2);
  assert.equal(sorted[2].name, "B");

  const summary = statsController.buildShareableTournamentSummary({
    tournamentName: "Friday Cup",
    targetScore: 11,
    champion: "C",
    players,
    rounds,
    roomCode: "ABCD",
  });
  assert.equal(summary.includes("Torneo: Friday Cup"), true);
  assert.equal(summary.includes("Campeon: C"), true);
  assert.equal(summary.includes("Sala: ABCD"), true);
  assert.equal(summary.includes("1. C | PG 1"), true);
});

test("bracketView renderiza ronda y tarjetas", async () => {
  const bracketView = await importModule("src/ui/components/bracketView.js");
  const container = {
    innerHTML: "",
    children: [],
    appendChild(node) {
      this.children.push(node);
    },
  };

  const prevDocument = global.document;
  global.document = {
    createElement: () => ({ className: "", innerHTML: "" }),
  };
  try {
    bracketView.renderBracketView({
      container,
      rounds: [{ matches: [{ p1: "A", p2: "B", score1: 0, score2: 0, winner: null, isBye: false, status: "pending" }] }],
      players: ["A", "B"],
      playerMeta: {},
      previousRounds: null,
      currentUserIdentity: "A",
      isRoomAdmin: true,
      getAvatar: (name) => `<span>${name}</span>`,
      getPlayerBadges: () => "",
    });
  } finally {
    global.document = prevDocument;
  }

  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].innerHTML.includes("Ronda 1"), true);
  assert.equal(container.children[0].innerHTML.includes("LLAMAR"), true);
});

test("liveMatchView renderiza header y estado", async () => {
  const liveMatchView = await importModule("src/ui/components/liveMatchView.js");
  const store = new Map();
  const mkEl = () => ({
    textContent: "",
    innerHTML: "",
    style: {},
    classList: {
      _set: new Set(),
      add(name) { this._set.add(name); },
      remove(name) { this._set.delete(name); },
      contains(name) { return this._set.has(name); },
    },
  });
  const doc = {
    getElementById(id) {
      if (!store.has(id)) store.set(id, mkEl());
      return store.get(id);
    },
  };

  const match = { p1: "A", p2: "B", score1: 11, score2: 9, winner: null };
  liveMatchView.renderLiveMatchHeader({
    documentRef: doc,
    match,
    getAvatar: (name) => `<img alt="${name}">`,
    playerMeta: { A: { nickname: "aa" }, B: { nickname: "bb" } },
  });
  assert.equal(doc.getElementById("liveP1Name").textContent, "A");
  assert.equal(doc.getElementById("liveP2Nick").textContent, "bb");

  const out = liveMatchView.renderLiveMatchState({
    documentRef: doc,
    match,
    liveMatchIndices: { rIdx: 0, mIdx: 0 },
    currentRoomId: "ROOM1",
    votesByMatch: {},
    currentUserIdentity: "viewer",
    targetScore: 11,
    isWinningState: (s1, s2, target) => Math.max(s1, s2) >= target && Math.abs(s1 - s2) >= 2,
    getCloseMatchHint: (s1, s2, target) => ({
      canClose: s1 >= target && s1 - s2 >= 2,
      text: s1 >= target && s1 - s2 >= 2 ? "Listo para finalizar el partido" : "Falta score",
    }),
  });
  assert.equal(out.shouldCelebrate, true);
  assert.equal(doc.getElementById("liveFinishBtnContainer").classList.contains("hidden"), false);
  assert.equal(doc.getElementById("liveCloseHint").textContent, "Listo para finalizar el partido");
});

test("bootstrap resuelve config y conecta firebase", async () => {
  const bootstrap = await importModule("src/app/bootstrap.js");
  const fallback = bootstrap.getFallbackFirebaseConfig();
  const resolved = bootstrap.resolveFirebaseConfig('{"apiKey":"k","projectId":"p"}', fallback);
  assert.equal(resolved.apiKey, "k");
  assert.equal(resolved.projectId, "p");

  const connected = await bootstrap.connectFirebase({
    firebaseConfig: { apiKey: "k", projectId: "proj" },
    initFirebaseServices: async () => ({ app: {}, auth: {}, db: {} }),
    onStatus: () => {},
  });
  assert.equal(!!connected, true);
  assert.equal(connected.dbPathPrefix, "artifacts/proj/public/data/tournaments");
});

test("featuredMatchView encuentra match activo y renderiza card", async () => {
  const featured = await importModule("src/ui/components/featuredMatchView.js");
  const out = featured.findFeaturedMatch([
    { matches: [{ p1: "A", p2: "B", score1: 0, score2: 0, winner: null, isBye: false, status: "pending" }] },
    { matches: [{ p1: "C", p2: "D", score1: 1, score2: 0, winner: null, isBye: false, status: "ready" }] },
  ]);
  assert.equal(!!out, true);
  assert.equal(out.indices.r, 1);

  const container = {
    innerHTML: "",
    classList: {
      _set: new Set(["hidden"]),
      add(name) { this._set.add(name); },
      remove(name) { this._set.delete(name); },
      contains(name) { return this._set.has(name); },
    },
  };
  featured.renderFeaturedMatchCard({
    container,
    featured: out,
    currentRoomId: "ROOM",
    votesByMatch: {},
    currentUserIdentity: "viewer",
    getAvatar: (name) => `<span>${name}</span>`,
    getPlayerBadges: () => "",
  });
  assert.equal(container.classList.contains("hidden"), false);
  assert.equal(container.innerHTML.includes("ARBITRAR"), true);
});

test("notificationController detecta notificaciones y nuevos ganadores", async () => {
  const notification = await importModule("src/controllers/notificationController.js");
  const ids = notification.collectMyTurnNotifications(
    [{ matches: [{ p1: "A", p2: "B", score1: 1, score2: 0, winner: null, isBye: false, status: "ready" }] }],
    "A",
    new Set()
  );
  assert.equal(ids.length, 1);
  assert.equal(ids[0], "r0m0");

  const winners = notification.detectNewWinners(
    [{ matches: [{ winner: null }] }],
    [{ matches: [{ winner: "A" }] }]
  );
  assert.equal(winners.length, 1);
  assert.equal(winners[0], "A");
});

test("overlayView muestra notificacion y anima VAR", async () => {
  const overlayView = await importModule("src/ui/components/overlayView.js");
  const mkClassList = () => ({
    _set: new Set(["hidden"]),
    add(name) { this._set.add(name); },
    remove(name) { this._set.delete(name); },
    contains(name) { return this._set.has(name); },
  });
  const map = new Map();
  const doc = {
    getElementById(id) {
      if (!map.has(id)) map.set(id, { textContent: "", classList: mkClassList() });
      return map.get(id);
    },
  };
  let vibrated = false;
  let played = [];
  overlayView.showNotificationOverlayView(doc, { vibrate: () => { vibrated = true; } }, (...args) => played.push(args[0]));
  assert.equal(vibrated, true);
  assert.equal(played.includes("notify"), true);

  const timers = [];
  overlayView.playVarAnimationView(doc, (...args) => played.push(args[0]), (fn) => timers.push(fn), () => 0);
  assert.equal(doc.getElementById("varStatusText").textContent, "ANALIZANDO JUGADA...");
  timers.forEach((fn) => fn());
  assert.equal(doc.getElementById("varOverlay").classList.contains("hidden"), true);
});

test("layoutView sincroniza secciones, live modal y campeon", async () => {
  const layoutView = await importModule("src/ui/components/layoutView.js");
  const mkClassList = () => ({
    _set: new Set(["hidden"]),
    add(name) { this._set.add(name); },
    remove(name) { this._set.delete(name); },
    contains(name) { return this._set.has(name); },
  });
  const map = new Map();
  const doc = {
    getElementById(id) {
      if (!map.has(id)) map.set(id, { textContent: "", innerHTML: "", classList: mkClassList() });
      return map.get(id);
    },
  };

  let featured = 0, bracket = 0, playerList = 0;
  layoutView.renderSetupOrBracketView(
    doc,
    { active: true, isCreator: true, currentUserIdentity: "A" },
    { renderFeaturedMatch: () => { featured++; }, renderBracket: () => { bracket++; }, renderPlayerList: () => { playerList++; } }
  );
  assert.equal(featured, 1);
  assert.equal(bracket, 1);
  assert.equal(playerList, 0);

  doc.getElementById("liveMatchModal").classList.remove("hidden");
  let updated = 0;
  layoutView.syncLiveMatchModal(
    doc,
    [{ matches: [{ p1: "A", p2: "B" }] }],
    { rIdx: 0, mIdx: 0 },
    { updateLiveMatchUI: () => { updated++; }, closeLiveMatch: () => {} }
  );
  assert.equal(updated, 1);

  const winnerAck = layoutView.syncChampionAnnouncement(
    doc,
    { champion: "A", winnerAcknowledged: false },
    { getAvatar: () => "avatar", confetti: () => {}, playSound: () => {} }
  );
  assert.equal(winnerAck, false);
  assert.equal(doc.getElementById("winnerText").textContent, "A");
});

test("profileController calcula stats y badges", async () => {
  const profile = await importModule("src/controllers/profileController.js");
  const perf = profile.calculatePlayerPerformance(
    [{ matches: [{ p1: "A", p2: "B", score1: 11, score2: 8, winner: "A", isBye: false }] }],
    "A",
    11
  );
  assert.equal(perf.played, 1);
  assert.equal(perf.won, 1);
  assert.equal(perf.winRate, 100);
  const g = profile.getGlobalPlayerStats({ A: { played: 10, won: 7, tourneys: 1 } }, "A");
  const sets = profile.getProfileBadgeSets(perf, g);
  assert.equal(Array.isArray(sets.currentBadges), true);
  assert.equal(profile.buildBracketBadgesHtml(perf).includes("fa-fire"), false);
});

test("profileView renderiza modal y grilla de badges", async () => {
  const profileView = await importModule("src/ui/components/profileView.js");
  const mkClassList = () => ({
    _set: new Set(["hidden"]),
    add(name) { this._set.add(name); },
    remove(name) { this._set.delete(name); },
    contains(name) { return this._set.has(name); },
  });
  const map = new Map();
  const doc = {
    getElementById(id) {
      if (!map.has(id)) map.set(id, { textContent: "", innerHTML: "", classList: mkClassList() });
      return map.get(id);
    },
  };
  profileView.renderProfileModalView(doc, {
    playerName: "A",
    nickname: "Ace",
    avatarHtml: "<img>",
    canEdit: true,
    perf: { played: 3, won: 2, winRate: 67 },
    globalStats: { played: 10, won: 6, tourneys: 1 },
  });
  profileView.renderBadgeGrid(doc, "badgesContainerCurrent", [{ icon: "X", name: "x", desc: "d", unlocked: true }]);
  assert.equal(doc.getElementById("profileName").textContent, "A");
  assert.equal(doc.getElementById("profileModal").classList.contains("hidden"), false);
  assert.equal(doc.getElementById("badgesContainerCurrent").innerHTML.includes("X"), true);
});
