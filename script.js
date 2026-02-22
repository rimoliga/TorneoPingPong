import { arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initFirebaseServices } from "./src/services/firebase/firebaseClient.js";
import { createRoom, patchRoom, subscribeRoom } from "./src/services/firebase/roomRepository.js";
import { normalizeReadyPlayers } from "./src/domain/readyService.js";
import { isWinningState, canFinalizeMatch, getWinnerByScore } from "./src/domain/scoringService.js";
import { isClaimStaleForPlayer, canUseStoredIdentity, buildClaimPatch } from "./src/domain/identityService.js";
import { buildMatchKey, resolveVoteScope, buildLocalVoteKey, canPlayerVoteMatch, buildNextVotes } from "./src/domain/votingService.js";
import { buildToggleReadyUpdate, buildTournamentMatches, validateStartTournament, buildStartTournamentConfirmation } from "./src/controllers/roomController.js";
import { applyRoundProgression } from "./src/controllers/matchController.js";
import { calculateTournamentStats } from "./src/controllers/statsController.js";
import { collectMyTurnNotifications, detectNewWinners } from "./src/controllers/notificationController.js";
import { calculatePlayerPerformance, getGlobalPlayerStats, getProfileBadgeSets, buildBracketBadgesHtml } from "./src/controllers/profileController.js";
import { getFallbackFirebaseConfig, resolveFirebaseConfig, connectFirebase } from "./src/app/bootstrap.js";
import { renderSetupReadiness } from "./src/ui/components/setupReadinessView.js";
import { renderBracketView } from "./src/ui/components/bracketView.js";
import { renderLiveMatchHeader, renderLiveMatchState } from "./src/ui/components/liveMatchView.js";
import { findFeaturedMatch, renderFeaturedMatchCard } from "./src/ui/components/featuredMatchView.js";
import { showNotificationOverlayView, playVarAnimationView } from "./src/ui/components/overlayView.js";
import { renderSetupOrBracketView, syncLiveMatchModal, syncChampionAnnouncement } from "./src/ui/components/layoutView.js";
import { renderBadgeGrid, renderProfileModalView } from "./src/ui/components/profileView.js";

const injectedFirebaseConfig = typeof __firebase_config !== "undefined" ? __firebase_config : null;
const firebaseConfig = resolveFirebaseConfig(injectedFirebaseConfig, getFallbackFirebaseConfig());

let app, auth, db;
let currentRoomId = null;
let unsubscribeRoom = null;
let winnerAcknowledged = false;
let audioCtx = null;
let liveMatchIndices = null;
let previousRounds = null;
let lastVarTime = 0;
let currentUserIdentity = null;
let notifiedMatches = new Set();
let clientUUID = localStorage.getItem('p_pong_client_id') || crypto.randomUUID();
let claimHeartbeatInterval = null;
localStorage.setItem('p_pong_client_id', clientUUID);
const CLAIM_STALE_MS = 2 * 60 * 1000;
const CLAIM_HEARTBEAT_MS = 30 * 1000;

let gameState = { tournamentName: "Torneo sin nombre", targetScore: 11, players: [], playerMeta: {}, claims: {}, claimsMeta: {}, rounds: [], votes: {}, varTrigger: 0, active: false, champion: null, globalStats: {}, readyPlayers: {}, creatorName: null };

// --- UTILS DECLARATIONS ---
function getAvatar(name, size = 24) { const seed = name.replace(/\s/g, ''); const url = `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${seed}&backgroundColor=transparent`; return `<img src="${url}" width="${size}" height="${size}" class="rounded-full bg-white/10 avatar-img" alt="${name}">`; }

function showToast(msg, type) {
    const toast = document.getElementById('toast'); toast.textContent = msg; toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-xl transition-all duration-300 z-[90] ${type === 'error' ? 'bg-red-600' : 'bg-blue-600'} text-white`; toast.classList.remove('translate-y-20', 'opacity-0'); setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

function playSound(type, vol = 0.1) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    if (type === 'ping') { osc.type = 'sine'; osc.frequency.setValueAtTime(600, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1); gain.gain.setValueAtTime(vol, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1); osc.start(); osc.stop(audioCtx.currentTime + 0.1); }
    else if (type === 'win') { osc.type = 'triangle'; osc.frequency.setValueAtTime(440, audioCtx.currentTime); osc.frequency.setValueAtTime(554, audioCtx.currentTime + 0.1); osc.frequency.setValueAtTime(659, audioCtx.currentTime + 0.2); gain.gain.setValueAtTime(vol, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6); osc.start(); osc.stop(audioCtx.currentTime + 0.6); }
    else if (type === 'var') { const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < buf.length; i++) d[i] = Math.random() * 2 - 1; const n = audioCtx.createBufferSource(); n.buffer = buf; const g = audioCtx.createGain(); g.gain.setValueAtTime(0.05, audioCtx.currentTime); n.connect(g); g.connect(audioCtx.destination); n.start(); }
    else if (type === 'notify') { osc.type = 'square'; osc.frequency.setValueAtTime(880, audioCtx.currentTime); osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.2); gain.gain.setValueAtTime(vol, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5); osc.start(); osc.stop(audioCtx.currentTime + 0.5); }
}

// EXPOSE TO WINDOW
window.getAvatar = getAvatar;
window.showToast = showToast;
window.playSound = playSound;

window.initAudio = function () {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const btn = document.getElementById('audioBtn');
        if (btn) { btn.innerHTML = "<i class='fas fa-check'></i> Audio Activado"; btn.classList.replace('text-slate-300', 'text-blue-400'); btn.classList.replace('border-slate-700', 'border-blue-500'); }
        playSound('ping', 0.01);
    } else if (audioCtx.state === 'suspended') audioCtx.resume();
}

async function initApp() {
    const connected = await connectFirebase({
        firebaseConfig,
        initFirebaseServices,
        onStatus: updateStatus,
    });
    if (!connected) return;
    ({ app, auth, db } = connected);
    window.DB_PATH_PREFIX = connected.dbPathPrefix;
}
function updateStatus(msg, colorClass) { const el = document.getElementById('connectionStatus'); if (el) { el.innerHTML = `<i class="fas fa-wifi"></i> ${msg}`; el.className = `text-xs font-mono ${colorClass}`; } }
function getReadyPlayers() {
    return normalizeReadyPlayers(gameState.players, gameState.readyPlayers);
}

function getClaimsMeta() { return gameState.claimsMeta || {}; }
function isClaimStale(name) {
    return isClaimStaleForPlayer(name, gameState.claims, getClaimsMeta(), clientUUID, CLAIM_STALE_MS);
}

function isRoomAdmin() {
    if (auth?.currentUser && gameState.creator === auth.currentUser.uid) return true;
    if (currentUserIdentity && gameState.creatorName && currentUserIdentity === gameState.creatorName) return true;
    if (!gameState.creatorName && gameState.players.length > 0 && currentUserIdentity === gameState.players[0]) return true;
    if (!gameState.creator && gameState.players.length > 0 && currentUserIdentity === gameState.players[0]) return true;
    return false;
}

function stopClaimHeartbeat() {
    if (claimHeartbeatInterval) {
        clearInterval(claimHeartbeatInterval);
        claimHeartbeatInterval = null;
    }
}

async function touchClaim(name) {
    if (!name || !currentRoomId) return;
    await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, buildClaimPatch(name, clientUUID));
}

function startClaimHeartbeat(name) {
    stopClaimHeartbeat();
    claimHeartbeatInterval = setInterval(() => {
        if (!currentRoomId || !currentUserIdentity) return;
        touchClaim(name).catch(() => { });
    }, CLAIM_HEARTBEAT_MS);
}

function checkIdentity() {
    const storedName = localStorage.getItem(`p_pong_identity_${currentRoomId}`);
    const canUseStored = canUseStoredIdentity(storedName, gameState.players, gameState.claims, getClaimsMeta(), clientUUID, CLAIM_STALE_MS);
    if (canUseStored) {
        setIdentity(storedName);
        touchClaim(storedName).catch(() => { });
        return true;
    }
    document.getElementById('identitySection').classList.remove('hidden');
    document.getElementById('setupSection').classList.add('hidden');
    document.getElementById('bracketSection').classList.add('hidden');
    if (isRoomAdmin()) document.getElementById('adminAddPanel').classList.remove('hidden');
    else document.getElementById('adminAddPanel').classList.add('hidden');
    const list = document.getElementById('identityList'); list.innerHTML = '';
    gameState.players.forEach(p => {
        const isClaimed = gameState.claims && gameState.claims[p] && gameState.claims[p] !== clientUUID && !isClaimStale(p);
        const lockStyle = isClaimed ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-slate-700/50 cursor-pointer hover:border-cyan-500/50';
        const icon = isClaimed ? '<i class="fas fa-lock text-red-400"></i>' : getAvatar(p, 32);
        list.innerHTML += `<button onclick="claimIdentity('${p}')" ${isClaimed ? 'disabled' : ''} class="w-full flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 transition-all text-left ${lockStyle}">${icon}<span class="font-bold text-white">${p} ${isClaimed ? '(Ocupado)' : ''}</span></button>`;
    });
    return false;
}

window.adminQuickAdd = async function () {
    const name = document.getElementById('adminAddInput').value.trim(); const nick = document.getElementById('adminNickInput').value.trim();
    if (!name) return showToast("Escribe un nombre", "error");
    if (gameState.players.includes(name)) return showToast("Nombre ocupado", "error");
    const updateData = { players: arrayUnion(name) };
    if (nick) updateData[`playerMeta.${name}`] = { nickname: nick };
    await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, updateData);
    document.getElementById('adminAddInput').value = ''; document.getElementById('adminNickInput').value = ''; playSound('ping');
}

window.claimIdentity = async function (name) {
    localStorage.setItem(`p_pong_identity_${currentRoomId}`, name); setIdentity(name);
    const updateData = buildClaimPatch(name, clientUUID, true);
    await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, updateData); syncUI();
}

window.registerNewIdentity = async function () {
    const name = document.getElementById('newIdentityInput').value.trim(); const nick = document.getElementById('newIdentityNick').value.trim();
    if (!name) return showToast("Escribe un nombre", "error");
    if (gameState.players.includes(name)) return showToast("Nombre ocupado", "error");
    const updateData = { players: arrayUnion(name) };
    if (nick) updateData[`playerMeta.${name}`] = { nickname: nick };
    Object.assign(updateData, buildClaimPatch(name, clientUUID, true));
    await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, updateData);
    localStorage.setItem(`p_pong_identity_${currentRoomId}`, name); setIdentity(name);
}

function setIdentity(name) {
    currentUserIdentity = name;
    startClaimHeartbeat(name);
    document.getElementById('identitySection').classList.add('hidden');
    document.getElementById('welcomeMsg').classList.remove('hidden');
    document.getElementById('userIdName').textContent = name;
    document.getElementById('profileBtn').classList.remove('hidden');
    document.getElementById('headerAvatar').innerHTML = getAvatar(name, 24);
}

window.switchProfileTab = function (tab) {
    const cur = document.getElementById('statsCurrent'); const glob = document.getElementById('statsGlobal');
    const btnC = document.getElementById('tabCurrent'); const btnG = document.getElementById('tabGlobal');
    if (tab === 'current') { cur.classList.remove('hidden'); glob.classList.add('hidden'); btnC.classList.add('text-blue-400', 'border-blue-400'); btnC.classList.remove('text-slate-500', 'border-transparent'); btnG.classList.remove('text-indigo-400', 'border-indigo-400'); btnG.classList.add('text-slate-500', 'border-transparent'); }
    else { cur.classList.add('hidden'); glob.classList.remove('hidden'); btnG.classList.add('text-indigo-400', 'border-indigo-400'); btnG.classList.remove('text-slate-500', 'border-transparent'); btnC.classList.remove('text-blue-400', 'border-blue-400'); btnC.classList.add('text-slate-500', 'border-transparent'); }
}

window.toggleEditProfile = function () {
    const display = document.getElementById('profileDisplay');
    const edit = document.getElementById('profileEdit');
    if (display.classList.contains('hidden')) {
        display.classList.remove('hidden'); edit.classList.add('hidden');
    } else {
        display.classList.add('hidden'); edit.classList.remove('hidden');
        const p = currentUserIdentity;
        document.getElementById('editNameInput').value = p;
        document.getElementById('editNickInput').value = gameState.playerMeta[p]?.nickname || "";
    }
}

window.saveProfileChanges = async function () {
    const newName = document.getElementById('editNameInput').value.trim();
    const newNick = document.getElementById('editNickInput').value.trim();
    if (!newName) return showToast("Nombre vacio", "error");
    const oldName = currentUserIdentity;
    const updates = {};
    updates[`playerMeta.${newName}`] = { nickname: newNick };
    if (newName !== oldName) {
        if (gameState.players.includes(newName)) return showToast("Nombre ocupado", "error");
        const newPlayers = gameState.players.filter(p => p !== oldName).concat([newName]);
        const newPlayerMeta = { ...gameState.playerMeta };
        delete newPlayerMeta[oldName]; newPlayerMeta[newName] = { nickname: newNick };
        const newClaims = { ...gameState.claims };
        newClaims[newName] = newClaims[oldName]; delete newClaims[oldName];
        const newClaimsMeta = { ...getClaimsMeta() };
        if (newClaimsMeta[oldName]) { newClaimsMeta[newName] = { ...newClaimsMeta[oldName], updatedAt: Date.now() }; delete newClaimsMeta[oldName]; }
        const newReadyPlayers = { ...getReadyPlayers() };
        if (newReadyPlayers[oldName] !== undefined) { newReadyPlayers[newName] = newReadyPlayers[oldName]; delete newReadyPlayers[oldName]; }
        const newGlobalStats = { ...gameState.globalStats };
        if (newGlobalStats[oldName]) { newGlobalStats[newName] = newGlobalStats[oldName]; delete newGlobalStats[oldName]; }
        const newRounds = JSON.parse(JSON.stringify(gameState.rounds));
        newRounds.forEach(r => {
            r.matches.forEach(m => {
                if (m.p1 === oldName) m.p1 = newName; if (m.p2 === oldName) m.p2 = newName; if (m.winner === oldName) m.winner = newName;
            });
        });
        let newChampion = gameState.champion === oldName ? newName : gameState.champion;
        let newCreatorName = gameState.creatorName;
        if (gameState.creatorName === oldName) newCreatorName = newName;
        updates.players = newPlayers; updates.playerMeta = newPlayerMeta; updates.claims = newClaims; updates.claimsMeta = newClaimsMeta; updates.readyPlayers = newReadyPlayers; updates.globalStats = newGlobalStats; updates.rounds = newRounds; updates.champion = newChampion; updates.creatorName = newCreatorName;
        localStorage.setItem(`p_pong_identity_${currentRoomId}`, newName);
        setIdentity(newName);
    }
    await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, updates);
    window.toggleEditProfile();
    showToast("Perfil actualizado");
}

window.showProfileModal = function (playerName) {
    const p = playerName || currentUserIdentity;
    if (!p) return;
    const target = gameState.targetScore || 11;
    const perf = calculatePlayerPerformance(gameState.rounds, p, target);
    const gStats = getGlobalPlayerStats(gameState.globalStats, p);
    renderProfileModalView(document, {
        playerName: p,
        nickname: gameState.playerMeta[p]?.nickname || "",
        avatarHtml: getAvatar(p, 80),
        canEdit: p === currentUserIdentity,
        perf,
        globalStats: gStats,
    });
    const badgeSets = getProfileBadgeSets(perf, gStats);
    renderBadgeGrid(document, "badgesContainerCurrent", badgeSets.currentBadges);
    renderBadgeGrid(document, "badgesContainerGlobal", badgeSets.globalBadges);
    window.switchProfileTab('current');
}
window.closeProfileModal = function () { document.getElementById('profileModal').classList.add('hidden'); }

window.confirmReset = async function () {
    const newStats = JSON.parse(JSON.stringify(gameState.globalStats || {}));
    const initStat = (name) => { if (!newStats[name]) newStats[name] = { played: 0, won: 0, tourneys: 0 }; };
    gameState.players.forEach(p => initStat(p));
    gameState.rounds.forEach(r => {
        r.matches.forEach(m => {
            if (m.isBye) return;
            if (m.winner) {
                initStat(m.p1); initStat(m.p2);
                newStats[m.p1].played++;
                newStats[m.p2].played++;
                newStats[m.winner].won++;
            }
        });
    });
    if (gameState.champion) {
        initStat(gameState.champion);
        newStats[gameState.champion].tourneys++;
    }
    await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, { active: false, rounds: [], champion: null, votes: {}, claims: {}, claimsMeta: {}, globalStats: newStats, activeSince: null, readyPlayers: {} });
    closeResetModal();
    closeLiveMatch();
}

window.createRoom = async function () {
    if (!auth.currentUser) return showToast("Conectando...", "error");
    initAudio(); const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const tName = document.getElementById('tourneyNameInput').value || "Torneo sin nombre";
    const cName = document.getElementById('creatorNameInput').value.trim();
    const target = parseInt(document.getElementById('pointsInput').value) || 11;

    const initialPlayers = cName ? [cName] : [];
    const initialClaims = {};
    const initialClaimsMeta = {};
    const initialReadyPlayers = {};
    if (cName) initialClaims[cName] = clientUUID;
    if (cName) initialClaimsMeta[cName] = { clientUUID, updatedAt: Date.now() };
    if (cName) initialReadyPlayers[cName] = false;

    try {
        await createRoom(db, window.DB_PATH_PREFIX, code, {
            tournamentName: tName,
            targetScore: target,
            players: initialPlayers,
            playerMeta: {},
            claims: initialClaims,
            claimsMeta: initialClaimsMeta,
            rounds: [],
            votes: {},
            varTrigger: 0,
            active: false,
            activeSince: null,
            champion: null,
            globalStats: {},
            readyPlayers: initialReadyPlayers,
            createdAt: new Date().toISOString(),
            creator: auth.currentUser.uid,
            creatorName: cName || null
        });

        if (cName) localStorage.setItem(`p_pong_identity_${code}`, cName);
        enterRoom(code);
    } catch (e) { showToast("Error: " + e.message, "error"); }
}

window.joinRoom = function () { const code = document.getElementById('joinCodeInput').value.trim().toUpperCase(); if (code.length < 2) return showToast("Codigo invalido", "error"); initAudio(); enterRoom(code); }

function enterRoom(code) {
    if (unsubscribeRoom) unsubscribeRoom(); currentRoomId = code;
    document.getElementById('lobbySection').classList.add('hidden'); document.getElementById('roomDisplay').classList.remove('hidden'); document.getElementById('roomCodeDisplay').textContent = code;
    previousRounds = null; notifiedMatches.clear();
    unsubscribeRoom = subscribeRoom(db, window.DB_PATH_PREFIX, code, (snap) => {
        if (snap.exists()) {
            const newData = snap.data();
            if (gameState.active && previousRounds && newData.rounds) checkForNewWinners(newData.rounds);
            if (newData.varTrigger && newData.varTrigger > lastVarTime) { lastVarTime = newData.varTrigger; playVarAnimation(); }
            gameState = newData;
            if (!gameState.votes) gameState.votes = {}; if (!gameState.playerMeta) gameState.playerMeta = {}; if (!gameState.claims) gameState.claims = {}; if (!gameState.claimsMeta) gameState.claimsMeta = {}; if (!gameState.globalStats) gameState.globalStats = {}; if (!gameState.readyPlayers) gameState.readyPlayers = {};
            if (gameState.rounds) previousRounds = JSON.parse(JSON.stringify(gameState.rounds));
            syncUI(); checkMyTurn();
        } else { showToast("Sala no encontrada", "error"); exitRoom(); }
    });
}
function exitRoom() { stopClaimHeartbeat(); currentRoomId = null; currentUserIdentity = null; document.getElementById('lobbySection').classList.remove('hidden'); document.getElementById('setupSection').classList.add('hidden'); document.getElementById('identitySection').classList.add('hidden'); document.getElementById('bracketSection').classList.add('hidden'); document.getElementById('roomDisplay').classList.add('hidden'); document.getElementById('welcomeMsg').classList.add('hidden'); document.getElementById('profileBtn').classList.add('hidden'); }

function syncUI() {
    if (!currentUserIdentity) { if (!checkIdentity()) return; }
    if (gameState.tournamentName) document.getElementById('mainTitle').innerHTML = gameState.tournamentName.toUpperCase().replace(' ', '<br>');
    const target = gameState.targetScore || 11; document.getElementById('rulesDisplay').textContent = `A ${target} Puntos`;

    const isCreator = isRoomAdmin();

    const resetBtn = document.getElementById('resetBtn'); if (isCreator) resetBtn.classList.remove('hidden'); else resetBtn.classList.add('hidden');
    const winnerResetBtn = document.getElementById('winnerResetBtn'); if (isCreator) winnerResetBtn.classList.remove('hidden'); else winnerResetBtn.classList.add('hidden');
    renderSetupOrBracketView(document, { active: gameState.active, isCreator, currentUserIdentity }, { renderFeaturedMatch, renderBracket, renderPlayerList });
    syncLiveMatchModal(document, gameState.rounds, liveMatchIndices, { updateLiveMatchUI, closeLiveMatch });
    winnerAcknowledged = syncChampionAnnouncement(document, { champion: gameState.champion, winnerAcknowledged }, { getAvatar, confetti, playSound });
    if (!document.getElementById('statsModal').classList.contains('hidden')) calculateAndRenderStats();
}

window.callToPlay = async function (rIdx, mIdx) { const rounds = JSON.parse(JSON.stringify(gameState.rounds)); rounds[rIdx].matches[mIdx].status = 'ready'; await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, { rounds }); showToast("Jugadores llamados!"); }
function checkMyTurn() { if (!currentUserIdentity || !gameState.active) return; const nextIds = collectMyTurnNotifications(gameState.rounds, currentUserIdentity, notifiedMatches); if (nextIds.length > 0) { nextIds.forEach(id => notifiedMatches.add(id)); showNotificationOverlay(); } }
function showNotificationOverlay() { showNotificationOverlayView(document, navigator, playSound); }
window.closeNotification = function () { document.getElementById('notificationOverlay').classList.add('hidden'); }
function checkForNewWinners(newRounds) { const winners = detectNewWinners(previousRounds, newRounds); winners.forEach((winner) => showToast(`${winner} gano su partido!`)); if (winners.length > 0) { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); playSound('win', 0.3); } }
window.triggerVar = async function () { await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, { varTrigger: Date.now() }); }
function playVarAnimation() { playVarAnimationView(document, playSound, setTimeout, Math.random); }

function renderFeaturedMatch() {
    const container = document.getElementById('featuredMatchContainer');
    const featured = findFeaturedMatch(gameState.rounds);
    renderFeaturedMatchCard({
        container,
        featured,
        currentRoomId,
        votesByMatch: gameState.votes,
        currentUserIdentity,
        getAvatar,
        getPlayerBadges,
    });
}

window.openLiveMatch = function (rIdx, mIdx) { const match = gameState.rounds[rIdx].matches[mIdx]; if (match.isBye) return; liveMatchIndices = { rIdx, mIdx }; renderLiveMatchHeader({ documentRef: document, match, getAvatar, playerMeta: gameState.playerMeta }); updateLiveMatchUI(match); document.getElementById('liveMatchModal').classList.remove('hidden'); }
window.closeLiveMatch = function () { document.getElementById('liveMatchModal').classList.add('hidden'); liveMatchIndices = null; }
function updateLiveMatchUI(match) { const target = gameState.targetScore || 11; const { shouldCelebrate } = renderLiveMatchState({ documentRef: document, match, liveMatchIndices, currentRoomId, votesByMatch: gameState.votes, currentUserIdentity, targetScore: target, isWinningState }); if (shouldCelebrate) confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } }); }
window.voteFor = async function (rIdx, mIdx, playerNum) { let r = rIdx, m = mIdx, p = playerNum; if (arguments.length === 1) { if (!liveMatchIndices) return; r = liveMatchIndices.rIdx; m = liveMatchIndices.mIdx; p = arguments[0]; } const match = gameState.rounds[r].matches[m]; if (!canPlayerVoteMatch(match, currentUserIdentity)) return showToast("No puedes votar en tu propio partido", "error"); const matchKey = buildMatchKey(currentRoomId, r, m); const voteScope = resolveVoteScope(gameState.activeSince, gameState.createdAt); const localVoteKey = buildLocalVoteKey(matchKey, voteScope); if (localStorage.getItem(localVoteKey)) return showToast("Ya votaste en este partido", "error"); const votes = buildNextVotes(gameState.votes, matchKey, p); await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, { votes: votes }); localStorage.setItem(localVoteKey, "true"); showToast("Voto registrado!"); playSound('ping', 0.05); }
window.toggleReady = async function () {
    const result = buildToggleReadyUpdate(currentUserIdentity, getReadyPlayers());
    if (!result.ok) return showToast(result.error, "error");
    await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, { readyPlayers: result.nextReadyPlayers });
};
window.liveScore = async function (playerNum, delta) { if (!liveMatchIndices) return; const { rIdx, mIdx } = liveMatchIndices; const rounds = JSON.parse(JSON.stringify(gameState.rounds)); const match = rounds[rIdx].matches[mIdx]; if (match.winner && delta > 0) return; if (match.winner && delta < 0) { match.winner = null; if (rounds.length === rIdx + 1) gameState.champion = null; } const target = gameState.targetScore || 11; const isAlreadyWon = isWinningState(match.score1, match.score2, target); if (delta > 0 && isAlreadyWon && !match.winner) return; let newVal = (playerNum === 1 ? match.score1 : match.score2) + delta; if (newVal < 0) newVal = 0; if (playerNum === 1) match.score1 = newVal; else match.score2 = newVal; if (delta > 0) playSound('ping'); await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, { rounds, champion: gameState.champion }); }
window.finishLiveMatch = function () { if (!liveMatchIndices) return; finishMatch(liveMatchIndices.rIdx, liveMatchIndices.mIdx); closeLiveMatch(); }
window.addPlayer = async function () { const name = document.getElementById('playerInput').value.trim(); const nick = document.getElementById('playerNickInput').value.trim(); if (!name || gameState.players.includes(name)) return; const updateData = { players: arrayUnion(name) }; if (nick) updateData[`playerMeta.${name}`] = { nickname: nick }; updateData[`readyPlayers.${name}`] = false; await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, updateData); document.getElementById('playerInput').value = ''; document.getElementById('playerNickInput').value = ''; playSound('ping'); }
window.removePlayer = async function (idx) { const newP = [...gameState.players]; const removed = newP[idx]; newP.splice(idx, 1); const readyPlayers = { ...getReadyPlayers() }; const claims = { ...(gameState.claims || {}) }; const claimsMeta = { ...getClaimsMeta() }; delete readyPlayers[removed]; delete claims[removed]; delete claimsMeta[removed]; await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, { players: newP, readyPlayers, claims, claimsMeta }); }

window.startTournament = async function () {
    const validation = validateStartTournament(gameState.players, getReadyPlayers());
    if (!validation.ok) return showToast(validation.error, "error");
    const buildResult = buildTournamentMatches(gameState.players);
    if (!buildResult.ok) return showToast(buildResult.error, "error");
    await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, { rounds: [{ matches: buildResult.matches }], active: true, activeSince: Date.now(), champion: null, readyPlayers: {} });
    closeStartTournamentModal();
    playSound('win', 0.2);
}

window.updateScore = async function (rIdx, mIdx, pNum, val) { const rounds = JSON.parse(JSON.stringify(gameState.rounds)); const match = rounds[rIdx].matches[mIdx]; if (pNum === 1) match.score1 = parseInt(val); else match.score2 = parseInt(val); await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, { rounds }); }

window.finishMatch = async function (rIdx, mIdx) {
    const rounds = JSON.parse(JSON.stringify(gameState.rounds));
    const matches = rounds[rIdx].matches;
    const match = matches[mIdx];
    const target = gameState.targetScore || 11;
    if (match.score1 === match.score2) return showToast("No empates", "error");
    if (!canFinalizeMatch(match.score1, match.score2, target)) return showToast(`Debe llegar a ${target} con 2 de diferencia`, "error");
    match.winner = getWinnerByScore(match.p1, match.p2, match.score1, match.score2);
    playSound('win');
    const progression = applyRoundProgression(rounds, gameState.players.length, rIdx);
    await patchRoom(db, window.DB_PATH_PREFIX, currentRoomId, { rounds: progression.rounds, champion: progression.champion });
}

function getPlayerBadges(name) {
    const target = gameState.targetScore || 11;
    const perf = calculatePlayerPerformance(gameState.rounds, name, target);
    return buildBracketBadgesHtml(perf);
}


window.showStatsModal = function () { document.getElementById('statsModal').classList.remove('hidden'); calculateAndRenderStats(); }
window.closeStatsModal = function () { document.getElementById('statsModal').classList.add('hidden'); }
function calculateAndRenderStats() {
    const sortedStats = calculateTournamentStats(gameState.players, gameState.rounds);
    const tbody = document.getElementById('statsTableBody'); tbody.innerHTML = '';
    sortedStats.forEach((s, i) => { const isLeader = i === 0 && s.won > 0; const rowClass = isLeader ? 'bg-yellow-500/20 text-yellow-200' : 'border-b border-slate-700/30 text-slate-300'; const isMe = s.name === currentUserIdentity; tbody.innerHTML += `<tr class="${rowClass}"> <td class="py-2 pl-2 font-mono text-slate-500/70">${i + 1}</td> <td class="py-2 flex items-center gap-2 clickable-name" onclick="showProfileModal('${s.name}')">${getAvatar(s.name, 24)} <span class="${isLeader ? 'font-bold' : ''} ${isMe ? 'me-highlight' : ''}">${s.name}</span></td> <td class="py-2 text-center font-mono">${s.played}</td> <td class="py-2 text-center font-mono font-bold">${s.won}</td> <td class="py-2 text-center font-mono text-xs ${s.diff > 0 ? 'text-green-400' : 'text-red-400'}">${s.diff > 0 ? '+' : ''}${s.diff}</td> </tr>`; });
}
window.copyRoomCode = function () { const code = document.getElementById('roomCodeDisplay').textContent; navigator.clipboard.writeText(code).then(() => showToast("Codigo copiado!")); }
window.toggleFullScreen = function () { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(e => console.log(e)); else if (document.exitFullscreen) document.exitFullscreen(); }
window.handleEnter = (e) => { if (e.key === 'Enter') addPlayer(); };
window.showResetModal = () => document.getElementById('resetModal').classList.remove('hidden');
window.closeResetModal = () => document.getElementById('resetModal').classList.add('hidden');
window.showStartTournamentModal = function () {
    const validation = validateStartTournament(gameState.players, getReadyPlayers());
    if (!validation.ok) return showToast(validation.error, "error");
    const textEl = document.getElementById("startTournamentConfirmText");
    if (textEl) textEl.textContent = buildStartTournamentConfirmation(gameState.players, gameState.targetScore);
    document.getElementById('startTournamentModal').classList.remove('hidden');
}
window.closeStartTournamentModal = () => document.getElementById('startTournamentModal').classList.add('hidden');
window.closeWinnerModal = () => { document.getElementById('winnerAnnouncement').classList.add('hidden'); winnerAcknowledged = true; };
window.showWinnerModal = () => { winnerAcknowledged = false; document.getElementById('winnerAnnouncement').classList.remove('hidden'); };

function renderBracket() {
    const container = document.getElementById('roundsContainer');
    renderBracketView({
        container,
        rounds: gameState.rounds,
        players: gameState.players,
        playerMeta: gameState.playerMeta,
        previousRounds,
        currentUserIdentity,
        isRoomAdmin: isRoomAdmin(),
        getAvatar,
        getPlayerBadges,
    });
}

function renderPlayerList() {
    const list = document.getElementById('playerList'); list.innerHTML = '';
    const readyPlayers = getReadyPlayers();
    gameState.players.forEach((p, i) => {
        const nick = gameState.playerMeta[p]?.nickname || ""; const isMe = p === currentUserIdentity; const isCreator = isRoomAdmin(); const removeBtn = isCreator ? `<button onclick="removePlayer(${i})" class="text-red-400 hover:bg-red-500/20 p-1 rounded"><i class="fas fa-times"></i></button>` : '';
        const readyBadge = readyPlayers[p] ? '<span class="text-[10px] text-emerald-300 border border-emerald-400/40 px-1 py-0.5 rounded">LISTO</span>' : '<span class="text-[10px] text-slate-400 border border-slate-600/40 px-1 py-0.5 rounded">PENDIENTE</span>';
        list.innerHTML += `<li class="flex justify-between items-center bg-slate-800/40 px-3 py-2 rounded border border-blue-900/50 animate-fade-in"><div><span class="text-white font-medium flex items-center gap-2 clickable-name" onclick="showProfileModal('${p}')">${getAvatar(p, 32)} <span class="${isMe ? 'me-highlight' : ''}">${p}</span> ${readyBadge}</span>${nick ? `<div class="text-[10px] text-slate-400 italic ml-10">${nick}</div>` : ''}</div>${removeBtn}</li>`;
    });
    renderSetupReadiness({
        players: gameState.players,
        readyPlayers,
        currentUserIdentity,
        playerCountEl: document.getElementById('playerCount'),
        readyCountEl: document.getElementById('readyCount'),
        readyBtnEl: document.getElementById('readyBtn'),
        startBtnEl: document.getElementById('startBtn'),
    });
}

initApp();





