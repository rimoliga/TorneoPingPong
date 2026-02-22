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
    navigator: {
      vibrate: () => {},
      clipboard: {
        writeText: async (text) => {
          context.window.__lastClipboardText = text;
        },
      },
    },
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
      addEventListener: () => {},
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
    initFirebaseServices: async () => ({
      app: {},
      auth: { currentUser: { uid: "u1" } },
      db: {},
    }),
    createRoom: async (_db, _prefix, _roomId, payload) => {
      context.window.__lastUpdatePayload = payload;
    },
    patchRoom: async (_db, _prefix, _roomId, payload) => {
      context.window.__lastUpdatePayload = payload;
    },
    subscribeRoom: () => () => {},
    normalizeReadyPlayers: (players, readyPlayers) => {
      const source = readyPlayers || {};
      const normalized = {};
      (players || []).forEach((p) => {
        normalized[p] = !!source[p];
      });
      return normalized;
    },
    countReadyPlayers: (players, readyPlayers) => {
      const source = readyPlayers || {};
      return (players || []).filter((p) => !!source[p]).length;
    },
    areAllPlayersReady: (players, readyPlayers) => {
      const list = players || [];
      if (list.length < 2) return false;
      const source = readyPlayers || {};
      return list.every((p) => !!source[p]);
    },
    isWinningState: (score1, score2, targetScore) =>
      Math.max(score1, score2) >= targetScore &&
      Math.abs(score1 - score2) >= 2,
    canFinalizeMatch: (score1, score2, targetScore) =>
      score1 !== score2 &&
      Math.max(score1, score2) >= targetScore &&
      Math.abs(score1 - score2) >= 2,
    getWinnerByScore: (p1, p2, score1, score2) =>
      score1 === score2 ? null : score1 > score2 ? p1 : p2,
    getCloseMatchHint: (score1, score2, targetScore) => {
      const target = targetScore || 11;
      const canClose = Math.max(score1, score2) >= target && Math.abs(score1 - score2) >= 2;
      if (canClose) return { canClose: true, text: "Listo para finalizar el partido" };
      return { canClose: false, text: "Faltan puntos para cerrar" };
    },
    buildToggleReadyUpdate: (currentUserIdentity, readyPlayers) => {
      if (!currentUserIdentity) {
        return { ok: false, error: "Primero elige tu identidad" };
      }
      const nextReadyPlayers = { ...(readyPlayers || {}) };
      nextReadyPlayers[currentUserIdentity] = !nextReadyPlayers[currentUserIdentity];
      return { ok: true, nextReadyPlayers };
    },
    buildTournamentMatches: (players) => {
      if (!players || players.length < 2) {
        return { ok: false, error: "Se requieren al menos 2 jugadores" };
      }
      const shuffled = [...players];
      const matches = [];
      while (shuffled.length > 0) {
        const p1 = shuffled.pop();
        const p2 = shuffled.length > 0 ? shuffled.pop() : null;
        matches.push({
          p1,
          p2,
          score1: 0,
          score2: 0,
          winner: p2 ? null : p1,
          isBye: !p2,
          status: "pending",
        });
      }
      return { ok: true, matches };
    },
    validateStartTournament: (players, readyPlayers) => {
      const list = players || [];
      if (list.length < 2) {
        return { ok: false, error: "Se requieren al menos 2 jugadores" };
      }
      const source = readyPlayers || {};
      const allReady = list.every((p) => !!source[p]);
      return allReady
        ? { ok: true }
        : { ok: false, error: "Faltan jugadores por marcarse como listos" };
    },
    buildStartTournamentConfirmation: (players, targetScore) =>
      `Se sortearan ${(players || []).length} jugadores a ${targetScore || 11} puntos.`,
    renderSetupReadiness: ({
      players,
      readyPlayers,
      currentUserIdentity,
      playerCountEl,
      readyCountEl,
      readyBtnEl,
      startBtnEl,
    }) => {
      const list = players || [];
      const source = readyPlayers || {};
      const readyCount = list.filter((p) => !!source[p]).length;
      const allReady = list.length >= 2 && list.every((p) => !!source[p]);
      if (playerCountEl) playerCountEl.textContent = `${list.length} Jugadores`;
      if (readyCountEl) readyCountEl.textContent = `${readyCount}/${list.length} listos`;
      if (readyBtnEl) {
        readyBtnEl.textContent =
          currentUserIdentity && source[currentUserIdentity] ? "NO LISTO" : "LISTO";
      }
      if (startBtnEl) startBtnEl.disabled = !allReady;
    },
    isClaimStaleForPlayer: (
      name,
      claims,
      claimsMeta,
      clientUUID,
      staleMs,
      now = Date.now()
    ) => {
      const owner = claims?.[name];
      if (!owner || owner === clientUUID) return false;
      const ts = claimsMeta?.[name]?.updatedAt || 0;
      if (!ts) return false;
      return now - ts > staleMs;
    },
    canUseStoredIdentity: (
      storedName,
      players,
      claims,
      claimsMeta,
      clientUUID,
      staleMs,
      now = Date.now()
    ) => {
      if (!storedName) return false;
      if (!(players || []).includes(storedName)) return false;
      const owner = claims?.[storedName];
      if (!owner || owner === clientUUID) return true;
      const ts = claimsMeta?.[storedName]?.updatedAt || 0;
      if (!ts) return false;
      return now - ts > staleMs;
    },
    buildClaimPatch: (name, clientUUID, includeReadyFlag = false, now = Date.now()) => {
      const patch = {};
      patch[`claims.${name}`] = clientUUID;
      patch[`claimsMeta.${name}`] = { clientUUID, updatedAt: now };
      if (includeReadyFlag) patch[`readyPlayers.${name}`] = false;
      return patch;
    },
    evaluateClaimStatus: (name, players, claims, claimsMeta, clientUUID, staleMs, now = Date.now()) => {
      if (!name || typeof name !== "string") return { ok: false, reason: "invalid_name" };
      if (Array.isArray(players) && !players.includes(name)) return { ok: false, reason: "not_found" };
      const owner = claims?.[name];
      if (!owner || owner === clientUUID) return { ok: true, reason: "available" };
      const ts = claimsMeta?.[name]?.updatedAt || 0;
      const isStale = ts > 0 && (now - ts) > staleMs;
      if (isStale) return { ok: true, reason: "stale_recoverable" };
      return { ok: false, reason: "occupied", retryInMs: ts > 0 ? Math.max(0, staleMs - (now - ts)) : staleMs };
    },
    getClaimBlockedMessage: (status) => {
      if (!status || status.ok) return "";
      if (status.reason === "not_found") return "Ese nombre no existe en esta sala";
      if (status.reason === "invalid_name") return "Nombre invalido";
      if (status.reason !== "occupied") return "No se puede reclamar ese nombre ahora";
      return "Nombre ocupado en este momento";
    },
    buildMatchKey: (roomId, roundIdx, matchIdx) => `${roomId}_r${roundIdx}m${matchIdx}`,
    resolveVoteScope: (activeSince, createdAt) => activeSince || createdAt || "legacy",
    buildLocalVoteKey: (matchKey, voteScope) => `voted_${matchKey}_${voteScope}`,
    canPlayerVoteMatch: (match, currentUserIdentity) =>
      !(match?.p1 === currentUserIdentity || match?.p2 === currentUserIdentity),
    buildNextVotes: (votes, matchKey, playerNum) => {
      const nextVotes = { ...(votes || {}) };
      if (!nextVotes[matchKey]) nextVotes[matchKey] = { p1: 0, p2: 0 };
      if (playerNum === 1) nextVotes[matchKey].p1++;
      else nextVotes[matchKey].p2++;
      return nextVotes;
    },
    applyRoundProgression: (rounds, playersCount, roundIdx) => {
      const matches = rounds[roundIdx]?.matches || [];
      let champion = null;
      if (!matches.every((m) => m.winner)) return { rounds, champion };
      const totalRounds = Math.ceil(Math.log2(playersCount));
      if (roundIdx === totalRounds - 1) {
        champion = matches[0]?.winner || null;
        return { rounds, champion };
      }
      if (!rounds[roundIdx + 1]) {
        const winners = matches.map((m) => m.winner);
        const nextMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
          const p1 = winners[i];
          const p2 = winners[i + 1] || null;
          nextMatches.push({
            p1,
            p2,
            score1: 0,
            score2: 0,
            winner: p2 ? null : p1,
            isBye: !p2,
            status: "pending",
          });
        }
        rounds.push({ matches: nextMatches });
      }
      return { rounds, champion };
    },
    calculateTournamentStats: (players, rounds) => {
      const stats = {};
      (players || []).forEach((p) => {
        stats[p] = { name: p, played: 0, won: 0, diff: 0 };
      });
      (rounds || []).forEach((round) => {
        (round.matches || []).forEach((m) => {
          if (m.isBye) return;
          if (m.score1 > 0 || m.score2 > 0 || m.winner) {
            if (stats[m.p1]) {
              stats[m.p1].played++;
              stats[m.p1].diff += m.score1 - m.score2;
            }
            if (m.p2 && stats[m.p2]) {
              stats[m.p2].played++;
              stats[m.p2].diff += m.score2 - m.score1;
            }
          }
          if (m.winner && stats[m.winner]) stats[m.winner].won++;
        });
      });
      return Object.values(stats).sort((a, b) => {
        if (a.won !== b.won) return b.won - a.won;
        return b.diff - a.diff;
      });
    },
    buildShareableTournamentSummary: ({
      tournamentName,
      targetScore,
      champion,
      players,
      rounds,
      roomCode,
    }) => {
      const table = context.calculateTournamentStats(players || [], rounds || []);
      return [
        `Torneo: ${tournamentName || "Torneo sin nombre"}`,
        `Campeon: ${champion || "Por definir"}`,
        `Formato: a ${targetScore || 11} puntos`,
        `Sala: ${roomCode || "----"}`,
        "",
        "Tabla final:",
        ...(table || []).slice(0, 4).map((r, idx) => `${idx + 1}. ${r.name}`),
      ].join("\n");
    },
    renderLiveMatchHeader: ({ documentRef, match }) => {
      if (!documentRef || !match) return;
      documentRef.getElementById("liveP1Name").textContent = match.p1;
      documentRef.getElementById("liveP2Name").textContent = match.p2;
    },
    renderLiveMatchState: ({
      documentRef,
      match,
      liveMatchIndices,
      currentRoomId,
      votesByMatch,
      currentUserIdentity,
      targetScore,
      isWinningState,
    }) => {
      if (!documentRef || !match || !liveMatchIndices) return { shouldCelebrate: false };
      documentRef.getElementById("liveP1Score").textContent = match.score1;
      documentRef.getElementById("liveP2Score").textContent = match.score2;
      const key = `${currentRoomId}_r${liveMatchIndices.rIdx}m${liveMatchIndices.mIdx}`;
      const votes = votesByMatch?.[key] || { p1: 0, p2: 0 };
      const totalVotes = votes.p1 + votes.p2;
      const p1Pct = totalVotes === 0 ? 50 : (votes.p1 / totalVotes) * 100;
      documentRef.getElementById("barVoteP1").style.width = `${p1Pct}%`;
      documentRef.getElementById("textVoteP1").textContent =
        totalVotes === 0 ? "50%" : `${Math.round(p1Pct)}%`;
      documentRef.getElementById("textVoteP2").textContent =
        totalVotes === 0 ? "50%" : `${Math.round(100 - p1Pct)}%`;
      const amIPlaying = match.p1 === currentUserIdentity || match.p2 === currentUserIdentity;
      if (amIPlaying) {
        documentRef.getElementById("voteBtnP1").classList.add("hidden");
        documentRef.getElementById("voteBtnP2").classList.add("hidden");
      } else {
        documentRef.getElementById("voteBtnP1").classList.remove("hidden");
        documentRef.getElementById("voteBtnP2").classList.remove("hidden");
      }
      const isWin = isWinningState(match.score1, match.score2, targetScore);
      if (isWin) {
        documentRef.getElementById("liveAreaP1").classList.add("locked-add");
        documentRef.getElementById("liveAreaP2").classList.add("locked-add");
      }
      return { shouldCelebrate: isWin && !match.winner };
    },
    getFallbackFirebaseConfig: () => ({
      apiKey: "__API_KEY__",
      authDomain: "__AUTH_DOMAIN__",
      projectId: "__PROJECT_ID__",
      storageBucket: "__STORAGE_BUCKET__",
      messagingSenderId: "__MESSAGING_SENDER_ID__",
      appId: "__APP_ID__",
    }),
    resolveFirebaseConfig: (injectedConfig, fallbackConfig) => {
      if (!injectedConfig) return fallbackConfig;
      try {
        return JSON.parse(injectedConfig);
      } catch (_e) {
        return fallbackConfig;
      }
    },
    connectFirebase: async ({ firebaseConfig, initFirebaseServices, onStatus }) => {
      if (firebaseConfig.apiKey.startsWith("__")) {
        onStatus?.("Falta Config", "text-orange-400");
        return null;
      }
      try {
        const out = await initFirebaseServices(firebaseConfig);
        const appId =
          firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("__")
            ? firebaseConfig.projectId
            : "ping-pong-app";
        onStatus?.("Conectado", "text-blue-400");
        return { ...out, dbPathPrefix: `artifacts/${appId}/public/data/tournaments` };
      } catch (_e) {
        onStatus?.("Error", "text-red-500");
        return null;
      }
    },
    findFeaturedMatch: (rounds) => {
      for (let r = 0; r < (rounds || []).length; r++) {
        for (let m = 0; m < (rounds[r].matches || []).length; m++) {
          const match = rounds[r].matches[m];
          if (!match.winner && !match.isBye && match.p2) {
            if (match.score1 > 0 || match.score2 > 0 || match.status === "ready") {
              return { match, indices: { r, m } };
            }
          }
        }
      }
      return null;
    },
    renderFeaturedMatchCard: ({ container, featured }) => {
      if (!container) return;
      if (!featured) {
        container.classList.add("hidden");
        return;
      }
      container.classList.remove("hidden");
      container.innerHTML = "featured";
    },
    collectMyTurnNotifications: (rounds, currentUserIdentity, notifiedMatches) => {
      if (!currentUserIdentity) return [];
      const out = [];
      (rounds || []).forEach((round, rIdx) => {
        (round.matches || []).forEach((m, mIdx) => {
          if (m.isBye || m.winner) return;
          if (m.p1 !== currentUserIdentity && m.p2 !== currentUserIdentity) return;
          const id = `r${rIdx}m${mIdx}`;
          const shouldNotify = m.status === "ready" || (m.score1 + m.score2) > 0;
          if (shouldNotify && !notifiedMatches.has(id)) out.push(id);
        });
      });
      return out;
    },
    detectNewWinners: (previousRounds, newRounds) => {
      const winners = [];
      (newRounds || []).forEach((r, rIdx) => {
        (r.matches || []).forEach((m, mIdx) => {
          const old = previousRounds?.[rIdx]?.matches?.[mIdx];
          if (old && !old.winner && m.winner) winners.push(m.winner);
        });
      });
      return winners;
    },
    showNotificationOverlayView: (documentRef, navigatorRef, playSoundFn) => {
      documentRef.getElementById("notificationOverlay").classList.remove("hidden");
      if (navigatorRef?.vibrate) navigatorRef.vibrate([200, 100, 200]);
      playSoundFn("notify", 0.5);
    },
    playVarAnimationView: (documentRef, playSoundFn, setTimeoutFn) => {
      const overlay = documentRef.getElementById("varOverlay");
      const text = documentRef.getElementById("varStatusText");
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      text.textContent = "ANALIZANDO JUGADA...";
      playSoundFn("var");
      setTimeoutFn(() => {
        text.textContent = "PUNTO VALIDO";
      }, 2000);
      setTimeoutFn(() => {
        overlay.classList.add("hidden");
        overlay.classList.remove("flex");
      }, 4500);
    },
    renderSetupOrBracketView: (documentRef, state, handlers) => {
      if (state.active) {
        documentRef.getElementById("setupSection").classList.add("hidden");
        documentRef.getElementById("bracketSection").classList.remove("hidden");
        handlers.renderFeaturedMatch();
        handlers.renderBracket();
      } else {
        documentRef.getElementById("bracketSection").classList.add("hidden");
        documentRef.getElementById("setupSection").classList.remove("hidden");
        handlers.renderPlayerList();
      }
    },
    syncLiveMatchModal: (documentRef, rounds, liveMatchIndices, handlers) => {
      if (documentRef.getElementById("liveMatchModal").classList.contains("hidden") || !liveMatchIndices) return;
      const round = rounds?.[liveMatchIndices.rIdx];
      if (round && round.matches?.[liveMatchIndices.mIdx]) handlers.updateLiveMatchUI(round.matches[liveMatchIndices.mIdx]);
      else handlers.closeLiveMatch();
    },
    syncChampionAnnouncement: (documentRef, state, handlers) => {
      const modal = documentRef.getElementById("winnerAnnouncement");
      const btn = documentRef.getElementById("showChampionBtn");
      if (state.champion) {
        btn.classList.remove("hidden");
        if (!state.winnerAcknowledged && modal.classList.contains("hidden")) {
          modal.classList.remove("hidden");
          documentRef.getElementById("winnerText").textContent = state.champion;
          documentRef.getElementById("winnerAvatarLarge").innerHTML =
            handlers.getAvatar(state.champion, 80);
          handlers.confetti({ particleCount: 150, spread: 100 });
          handlers.playSound("win", 0.3);
        }
        return state.winnerAcknowledged;
      }
      btn.classList.add("hidden");
      modal.classList.add("hidden");
      return false;
    },
    resolveOperatorShortcutAction: (event, { isLiveModalOpen, isRoomAdmin }) => {
      if (!event || !isLiveModalOpen || !isRoomAdmin) return null;
      if (event.code === "Digit1") return "p1_plus";
      if (event.code === "Digit2") return "p2_plus";
      if (event.code === "KeyQ") return "p1_minus";
      if (event.code === "KeyW") return "p2_minus";
      if (event.code === "Enter") return "finish_match";
      if (event.code === "Escape") return "close_modal";
      return null;
    },
    calculatePlayerPerformance: (rounds, playerName, targetScore) => {
      let played = 0;
      let won = 0;
      let streak = 0;
      let currentStreak = 0;
      let wallWins = 0;
      (rounds || []).forEach((round) => {
        (round.matches || []).forEach((m) => {
          if (m.isBye) return;
          const participated = m.p1 === playerName || m.p2 === playerName;
          if ((m.score1 > 0 || m.score2 > 0) && participated) played++;
          if (m.winner === playerName) {
            won++;
            currentStreak++;
            if (currentStreak > streak) streak = currentStreak;
            const oppScore = m.p1 === playerName ? m.score2 : m.score1;
            if (oppScore < targetScore / 2) wallWins++;
          } else if (m.winner && participated) {
            currentStreak = 0;
          }
        });
      });
      const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
      return { played, won, streak, wallWins, winRate };
    },
    getGlobalPlayerStats: (globalStats, playerName) =>
      globalStats?.[playerName] || { played: 0, won: 0, tourneys: 0 },
    getProfileBadgeSets: (perf, globalStats) => ({
      currentBadges: [{ icon: "F", unlocked: perf.streak >= 2 }],
      globalBadges: [{ icon: "P", unlocked: globalStats.tourneys >= 1 }],
    }),
    buildBracketBadgesHtml: (perf) => {
      let html = "";
      if (perf.streak >= 2) html += "F";
      if (perf.wallWins >= 1) html += "W";
      if (perf.won >= 1) html += "S";
      return html;
    },
    renderBadgeGrid: (documentRef, containerId, badges) => {
      const cont = documentRef.getElementById(containerId);
      cont.innerHTML = (badges || []).map((b) => b.icon).join("");
    },
    renderProfileModalView: (documentRef, model) => {
      documentRef.getElementById("profileName").textContent = model.playerName;
      documentRef.getElementById("profileModal").classList.remove("hidden");
    },
  };
  context.window = context;
  context.window.DB_PATH_PREFIX = "tests/path";
  context.window.__lastToast = null;
  context.window.__lastUpdatePayload = null;
  context.window.__lastClipboardText = null;

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

test("startTournament bloquea si no estan todos listos", async () => {
  const ctx = loadFrontendContext();
  const hooks = ctx.window.__TEST_HOOKS__;
  hooks.setCurrentRoomId("ROOM1");
  hooks.setCurrentIdentity("p1");
  hooks.setGameState({
    players: ["p1", "p2", "p3"],
    readyPlayers: { p1: true, p2: false, p3: true },
    rounds: [],
  });
  hooks.clearLastUpdatePayload();

  await ctx.window.startTournament();
  assert.equal(hooks.getLastUpdatePayload(), null);
  assert.equal(
    hooks.getLastToast()?.msg,
    "Faltan jugadores por marcarse como listos"
  );
});

test("startTournament permite sortear cuando todos estan listos", async () => {
  const ctx = loadFrontendContext();
  const hooks = ctx.window.__TEST_HOOKS__;
  hooks.setCurrentRoomId("ROOM1");
  hooks.setCurrentIdentity("p1");
  hooks.setGameState({
    players: ["p1", "p2", "p3", "p4"],
    readyPlayers: { p1: true, p2: true, p3: true, p4: true },
    rounds: [],
  });
  hooks.clearLastUpdatePayload();

  await ctx.window.startTournament();
  const payload = hooks.getLastUpdatePayload();
  assert.equal(payload.active, true);
  assert.equal(Array.isArray(payload.rounds), true);
  assert.equal(typeof payload.activeSince, "number");
});

test("showStartTournamentModal abre modal con mensaje", async () => {
  const ctx = loadFrontendContext();
  const hooks = ctx.window.__TEST_HOOKS__;
  hooks.setCurrentIdentity("p1");
  hooks.setGameState({
    players: ["p1", "p2"],
    targetScore: 11,
    readyPlayers: { p1: true, p2: true },
    rounds: [],
  });

  ctx.window.showStartTournamentModal();
  assert.equal(
    ctx.document.getElementById("startTournamentModal").classList.contains("hidden"),
    false
  );
  assert.equal(
    ctx.document.getElementById("startTournamentConfirmText").textContent.includes("2 jugadores"),
    true
  );
});

test("copyFinalSummary copia resumen final al portapapeles", async () => {
  const ctx = loadFrontendContext();
  const hooks = ctx.window.__TEST_HOOKS__;
  hooks.setCurrentRoomId("ROOM1");
  hooks.setGameState({
    tournamentName: "Viernes",
    targetScore: 11,
    champion: "A",
    players: ["A", "B"],
    rounds: [{ matches: [{ p1: "A", p2: "B", score1: 11, score2: 9, winner: "A", isBye: false }] }],
  });

  await ctx.window.copyFinalSummary();
  assert.equal(ctx.window.__lastClipboardText.includes("Torneo: Viernes"), true);
  assert.equal(ctx.window.__lastClipboardText.includes("Campeon: A"), true);
  assert.equal(hooks.getLastToast()?.msg, "Resumen copiado!");
});

test("handleLiveOperatorShortcut suma punto con Digit1 para admin", async () => {
  const ctx = loadFrontendContext();
  const hooks = ctx.window.__TEST_HOOKS__;
  hooks.setCurrentRoomId("ROOM1");
  hooks.setCurrentIdentity("p1");
  hooks.setGameState({
    players: ["p1", "p2"],
    targetScore: 11,
    champion: null,
    rounds: [{ matches: [{ p1: "p1", p2: "p2", score1: 0, score2: 0, winner: null }] }],
    votes: {},
  });
  hooks.setLiveMatchIndices({ rIdx: 0, mIdx: 0 });
  ctx.document.getElementById("liveMatchModal").classList.remove("hidden");
  hooks.clearLastUpdatePayload();

  await ctx.window.handleLiveOperatorShortcut({
    code: "Digit1",
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    target: { tagName: "DIV" },
    preventDefault: () => {},
  });
  const payload = hooks.getLastUpdatePayload();
  assert.equal(payload.rounds[0].matches[0].score1, 1);
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
