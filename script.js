import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, onSnapshot, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let firebaseConfig;
try { if (typeof __firebase_config !== 'undefined') firebaseConfig = JSON.parse(__firebase_config); else throw new Error("No config"); }
catch (e) { firebaseConfig = { apiKey: "__API_KEY__", authDomain: "__AUTH_DOMAIN__", projectId: "__PROJECT_ID__", storageBucket: "__STORAGE_BUCKET__", messagingSenderId: "__MESSAGING_SENDER_ID__", appId: "__APP_ID__" }; }

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
localStorage.setItem('p_pong_client_id', clientUUID);

let gameState = { tournamentName: "Torneo sin nombre", targetScore: 11, players: [], playerMeta: {}, claims: {}, rounds: [], votes: {}, varTrigger: 0, active: false, champion: null, globalStats: {}, readyPlayers: {} };

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
    if (firebaseConfig.apiKey.startsWith("__")) { updateStatus("Falta Config", "text-orange-400"); return; }
    try {
        app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app);
        const appId = firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("__") ? firebaseConfig.projectId : 'ping-pong-app';
        window.DB_PATH_PREFIX = `artifacts/${appId}/public/data/tournaments`;
        await signInAnonymously(auth);
        updateStatus("Conectado", "text-blue-400");
    } catch (error) { console.error(error); updateStatus("Error", "text-red-500"); }
}
function updateStatus(msg, colorClass) { const el = document.getElementById('connectionStatus'); if (el) { el.innerHTML = `<i class="fas fa-wifi"></i> ${msg}`; el.className = `text-xs font-mono ${colorClass}`; } }
function getReadyPlayers() { return gameState.readyPlayers || {}; }

function checkIdentity() {
    const storedName = localStorage.getItem(`p_pong_identity_${currentRoomId}`);
    if (storedName && gameState.players.includes(storedName)) { setIdentity(storedName); return true; }
    document.getElementById('identitySection').classList.remove('hidden');
    document.getElementById('setupSection').classList.add('hidden');
    document.getElementById('bracketSection').classList.add('hidden');
    if (auth.currentUser && gameState.creator === auth.currentUser.uid) document.getElementById('adminAddPanel').classList.remove('hidden');
    else document.getElementById('adminAddPanel').classList.add('hidden');
    const list = document.getElementById('identityList'); list.innerHTML = '';
    gameState.players.forEach(p => {
        const isClaimed = gameState.claims && gameState.claims[p] && gameState.claims[p] !== clientUUID;
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
    await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), updateData);
    document.getElementById('adminAddInput').value = ''; document.getElementById('adminNickInput').value = ''; playSound('ping');
}

window.claimIdentity = async function (name) {
    localStorage.setItem(`p_pong_identity_${currentRoomId}`, name); setIdentity(name);
    const updateData = {}; updateData[`claims.${name}`] = clientUUID;
    await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), updateData); syncUI();
}

window.registerNewIdentity = async function () {
    const name = document.getElementById('newIdentityInput').value.trim(); const nick = document.getElementById('newIdentityNick').value.trim();
    if (!name) return showToast("Escribe un nombre", "error");
    if (gameState.players.includes(name)) return showToast("Nombre ocupado", "error");
    const updateData = { players: arrayUnion(name) };
    if (nick) updateData[`playerMeta.${name}`] = { nickname: nick };
    updateData[`claims.${name}`] = clientUUID;
    await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), updateData);
    localStorage.setItem(`p_pong_identity_${currentRoomId}`, name); setIdentity(name);
}

function setIdentity(name) {
    currentUserIdentity = name;
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
        const newGlobalStats = { ...gameState.globalStats };
        if (newGlobalStats[oldName]) { newGlobalStats[newName] = newGlobalStats[oldName]; delete newGlobalStats[oldName]; }
        const newRounds = JSON.parse(JSON.stringify(gameState.rounds));
        newRounds.forEach(r => {
            r.matches.forEach(m => {
                if (m.p1 === oldName) m.p1 = newName; if (m.p2 === oldName) m.p2 = newName; if (m.winner === oldName) m.winner = newName;
            });
        });
        let newChampion = gameState.champion === oldName ? newName : gameState.champion;
        updates.players = newPlayers; updates.playerMeta = newPlayerMeta; updates.claims = newClaims; updates.globalStats = newGlobalStats; updates.rounds = newRounds; updates.champion = newChampion;
        localStorage.setItem(`p_pong_identity_${currentRoomId}`, newName);
        setIdentity(newName);
    }
    await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), updates);
    window.toggleEditProfile();
    showToast("Perfil actualizado");
}

window.showProfileModal = function (playerName) {
    const p = playerName || currentUserIdentity;
    if (!p) return;
    document.getElementById('profileName').textContent = p;
    document.getElementById('profileNick').textContent = gameState.playerMeta[p]?.nickname || "";
    document.getElementById('profileAvatarLarge').innerHTML = getAvatar(p, 80);

    const editBtn = document.getElementById('editProfileBtn');
    if (p === currentUserIdentity) editBtn.classList.remove('hidden');
    else editBtn.classList.add('hidden');

    document.getElementById('profileDisplay').classList.remove('hidden');
    document.getElementById('profileEdit').classList.add('hidden');

    let played = 0, won = 0, streak = 0, currentStreak = 0, wallWins = 0;
    const target = gameState.targetScore || 11;
    gameState.rounds.forEach(r => { r.matches.forEach(m => { if (m.isBye) return; if ((m.score1 > 0 || m.score2 > 0) && (m.p1 === p || m.p2 === p)) played++; if (m.winner === p) { won++; currentStreak++; if (currentStreak > streak) streak = currentStreak; const oppScore = m.p1 === p ? m.score2 : m.score1; if (oppScore < (target / 2)) wallWins++; } else if (m.winner && (m.p1 === p || m.p2 === p)) currentStreak = 0; }); });
    document.getElementById('statPJ').textContent = played; document.getElementById('statPG').textContent = won; document.getElementById('statWinRate').textContent = played > 0 ? Math.round((won / played) * 100) + '%' : '0%';
    const gStats = (gameState.globalStats && gameState.globalStats[p]) ? gameState.globalStats[p] : { played: 0, won: 0, tourneys: 0 };
    document.getElementById('gStatPJ').textContent = gStats.played; document.getElementById('gStatWins').textContent = gStats.won; document.getElementById('gStatChamp').textContent = gStats.tourneys;
    renderBadges(p, played, won, streak, wallWins, gStats);
    window.switchProfileTab('current');
    document.getElementById('profileModal').classList.remove('hidden');
}
window.closeProfileModal = function () { document.getElementById('profileModal').classList.add('hidden'); }

function renderBadges(p, played, won, streak, wallWins, gStats) {
    const cBadges = [{ icon: 'F', name: 'On Fire', desc: 'Racha 2+', check: () => streak >= 2 }, { icon: 'W', name: 'Muro', desc: 'Rival <50%', check: () => wallWins >= 1 }, { icon: 'S', name: '1ra Sangre', desc: 'Ganar 1', check: () => won >= 1 }, { icon: 'D', name: 'Debut', desc: 'Jugar 1', check: () => played >= 1 }];
    const gBadges = [{ icon: 'L', name: 'Leyenda', desc: '5+ Copas', check: () => gStats.tourneys >= 5 }, { icon: 'V', name: 'Veterano', desc: '20+ Partidos', check: () => gStats.played >= 20 }, { icon: 'N', name: 'Sniper', desc: '>60% Win', check: () => gStats.played > 10 && (gStats.won / gStats.played) > 0.6 }, { icon: 'P', name: 'Pro', desc: '1+ Copa', check: () => gStats.tourneys >= 1 }];
    const render = (list, containerId) => { const cont = document.getElementById(containerId); cont.innerHTML = ''; list.forEach(b => { const unlocked = b.check(); cont.innerHTML += `<div class="flex flex-col items-center p-2 bg-black/20 rounded border border-white/10 ${unlocked ? '' : 'opacity-30 grayscale'}"><div class="text-2xl mb-1 ${unlocked ? 'medal-unlocked' : 'medal-locked'}">${b.icon}</div><div class="text-[9px] font-bold text-white leading-tight">${b.name}</div><div class="text-[8px] text-gray-400 leading-tight mt-1">${b.desc}</div></div>`; }); };
    render(cBadges, 'badgesContainerCurrent'); render(gBadges, 'badgesContainerGlobal');
}

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
    await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), { active: false, rounds: [], champion: null, votes: {}, claims: {}, globalStats: newStats, activeSince: null, readyPlayers: {} });
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
    if (cName) initialClaims[cName] = clientUUID;

    try {
        await setDoc(doc(db, window.DB_PATH_PREFIX, code), {
            tournamentName: tName,
            targetScore: target,
            players: initialPlayers,
            playerMeta: {},
            claims: initialClaims,
            rounds: [],
            votes: {},
            varTrigger: 0,
            active: false,
            activeSince: null,
            champion: null,
            globalStats: {},
            readyPlayers: {},
            createdAt: new Date().toISOString(),
            creator: auth.currentUser.uid
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
    unsubscribeRoom = onSnapshot(doc(db, window.DB_PATH_PREFIX, code), (snap) => {
        if (snap.exists()) {
            const newData = snap.data();
            if (gameState.active && previousRounds && newData.rounds) checkForNewWinners(newData.rounds);
            if (newData.varTrigger && newData.varTrigger > lastVarTime) { lastVarTime = newData.varTrigger; playVarAnimation(); }
            gameState = newData;
            if (!gameState.votes) gameState.votes = {}; if (!gameState.playerMeta) gameState.playerMeta = {}; if (!gameState.claims) gameState.claims = {}; if (!gameState.globalStats) gameState.globalStats = {}; if (!gameState.readyPlayers) gameState.readyPlayers = {};
            if (gameState.rounds) previousRounds = JSON.parse(JSON.stringify(gameState.rounds));
            syncUI(); checkMyTurn();
        } else { showToast("Sala no encontrada", "error"); exitRoom(); }
    });
}
function exitRoom() { currentRoomId = null; currentUserIdentity = null; document.getElementById('lobbySection').classList.remove('hidden'); document.getElementById('setupSection').classList.add('hidden'); document.getElementById('identitySection').classList.add('hidden'); document.getElementById('bracketSection').classList.add('hidden'); document.getElementById('roomDisplay').classList.add('hidden'); document.getElementById('welcomeMsg').classList.add('hidden'); document.getElementById('profileBtn').classList.add('hidden'); }

function syncUI() {
    if (!currentUserIdentity) { if (!checkIdentity()) return; }
    if (gameState.tournamentName) document.getElementById('mainTitle').innerHTML = gameState.tournamentName.toUpperCase().replace(' ', '<br>');
    const target = gameState.targetScore || 11; document.getElementById('rulesDisplay').textContent = `A ${target} Puntos`;

    let isCreator = auth.currentUser && gameState.creator === auth.currentUser.uid;
    // Fallback: If no creator in DB or I am the first player (recovery), allow admin access
    if (!gameState.creator || (gameState.players.length > 0 && currentUserIdentity === gameState.players[0])) isCreator = true;

    const resetBtn = document.getElementById('resetBtn'); if (isCreator) resetBtn.classList.remove('hidden'); else resetBtn.classList.add('hidden');
    const winnerResetBtn = document.getElementById('winnerResetBtn'); if (isCreator) winnerResetBtn.classList.remove('hidden'); else winnerResetBtn.classList.add('hidden');
    if (gameState.active) { document.getElementById('setupSection').classList.add('hidden'); document.getElementById('bracketSection').classList.remove('hidden'); renderFeaturedMatch(); renderBracket(); }
    else { document.getElementById('bracketSection').classList.add('hidden'); if (!currentUserIdentity || isCreator) { document.getElementById('setupSection').classList.remove('hidden'); renderPlayerList(); } else { document.getElementById('setupSection').classList.remove('hidden'); renderPlayerList(); } }
    if (!document.getElementById('liveMatchModal').classList.contains('hidden') && liveMatchIndices) {
        const r = gameState.rounds[liveMatchIndices.rIdx];
        if (r && r.matches[liveMatchIndices.mIdx]) {
            updateLiveMatchUI(r.matches[liveMatchIndices.mIdx]);
        } else {
            closeLiveMatch();
        }
    }
    const modal = document.getElementById('winnerAnnouncement'); const btn = document.getElementById('showChampionBtn');
    if (gameState.champion) { btn.classList.remove('hidden'); if (!winnerAcknowledged && modal.classList.contains('hidden')) { modal.classList.remove('hidden'); document.getElementById('winnerText').textContent = gameState.champion; document.getElementById('winnerAvatarLarge').innerHTML = getAvatar(gameState.champion, 80); confetti({ particleCount: 150, spread: 100 }); playSound('win', 0.3); } } else { btn.classList.add('hidden'); modal.classList.add('hidden'); winnerAcknowledged = false; }
    if (!document.getElementById('statsModal').classList.contains('hidden')) calculateAndRenderStats();
}

window.callToPlay = async function (rIdx, mIdx) { const rounds = JSON.parse(JSON.stringify(gameState.rounds)); rounds[rIdx].matches[mIdx].status = 'ready'; await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), { rounds }); showToast("Jugadores llamados!"); }
function checkMyTurn() { if (!currentUserIdentity || !gameState.active) return; gameState.rounds.forEach((r, rIdx) => { r.matches.forEach((m, mIdx) => { if (m.isBye || m.winner) return; if ((m.p1 === currentUserIdentity || m.p2 === currentUserIdentity)) { const matchId = `r${rIdx}m${mIdx}`; const shouldNotify = (m.status === 'ready' || (m.score1 + m.score2 > 0)); if (shouldNotify && !notifiedMatches.has(matchId)) { notifiedMatches.add(matchId); showNotificationOverlay(); } } }); }); }
function showNotificationOverlay() { document.getElementById('notificationOverlay').classList.remove('hidden'); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); playSound('notify', 0.5); }
window.closeNotification = function () { document.getElementById('notificationOverlay').classList.add('hidden'); }
function checkForNewWinners(newRounds) { let winnerFound = false; newRounds.forEach((r, rIdx) => { r.matches.forEach((m, mIdx) => { const oldM = previousRounds[rIdx]?.matches[mIdx]; if (oldM && !oldM.winner && m.winner) { winnerFound = true; showToast(`${m.winner} gano su partido!`); } }); }); if (winnerFound) { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); playSound('win', 0.3); } }
window.triggerVar = async function () { await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), { varTrigger: Date.now() }); }
function playVarAnimation() { const overlay = document.getElementById('varOverlay'); const text = document.getElementById('varStatusText'); overlay.classList.remove('hidden'); overlay.classList.add('flex'); text.textContent = "ANALIZANDO JUGADA..."; playSound('var'); setTimeout(() => { const results = ["PUNTO VALIDO", "MALA MIA", "SE REPITE", "COMPRADO", "FUE AFUERA", "TODO LEGAL"]; text.textContent = results[Math.floor(Math.random() * results.length)]; }, 2000); setTimeout(() => { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }, 4500); }

function renderFeaturedMatch() {
    const container = document.getElementById('featuredMatchContainer'); let activeMatch = null; let activeIndices = null;
    for (let r = 0; r < gameState.rounds.length; r++) { for (let m = 0; m < gameState.rounds[r].matches.length; m++) { const match = gameState.rounds[r].matches[m]; if (!match.winner && !match.isBye && match.p2) { if (match.score1 > 0 || match.score2 > 0 || match.status === 'ready') { activeMatch = match; activeIndices = { r, m }; break; } } } if (activeMatch) break; }
    if (activeMatch) {
        container.classList.remove('hidden');
        const matchKey = `${currentRoomId}_r${activeIndices.r}m${activeIndices.m}`;
        const votes = gameState.votes[matchKey] || { p1: 0, p2: 0 };
        const totalVotes = votes.p1 + votes.p2;
        const p1Pct = totalVotes === 0 ? 50 : (votes.p1 / totalVotes) * 100;
        const amIPlaying = activeMatch.p1 === currentUserIdentity || activeMatch.p2 === currentUserIdentity;
        const voteClass = amIPlaying ? '' : 'cursor-pointer hover:opacity-80 transition-opacity';

        const voteClickAction = amIPlaying ? "void(" : `voteFor(${activeIndices.r},${activeIndices.m},`;
        const voteBtnStyle = amIPlaying ? 'invisible' : '';

        // Updated colors for Featured Match card
        container.innerHTML = `<div class="w-full featured-card rounded-xl p-3 pt-6 relative overflow-hidden"><div class="absolute top-0 left-0 w-full h-1 bg-yellow-400 animate-pulse"></div><div class="text-[10px] font-bold text-yellow-400 absolute top-1 left-1/2 transform -translate-x-1/2 tracking-widest uppercase">EN JUEGO</div><div class="flex justify-between items-center mb-2"><div class="flex flex-col items-center w-1/3 ${voteClass}" onclick="${voteClickAction}1)">${getAvatar(activeMatch.p1, 32)}<span class="font-bold text-white text-xs mt-1 truncate w-full text-center clickable-name" onclick="event.stopPropagation(); showProfileModal('${activeMatch.p1}')">${activeMatch.p1} ${getPlayerBadges(activeMatch.p1)}</span><div class="bg-cyan-900/50 text-cyan-400 text-[9px] px-2 py-0.5 rounded border border-cyan-700/50 mt-1 ${voteBtnStyle}">Votar</div></div><div class="flex flex-col items-center justify-center w-1/3 z-10"><div class="text-3xl font-mono font-bold text-white leading-none">${activeMatch.score1}-${activeMatch.score2}</div><button onclick="openLiveMatch(${activeIndices.r},${activeIndices.m})" class="mt-1 bg-yellow-500 hover:bg-yellow-400 text-black text-[10px] font-bold px-3 py-1 rounded-full shadow-lg animate-bounce">ARBITRAR</button></div><div class="flex flex-col items-center w-1/3 ${voteClass}" onclick="${voteClickAction}2)">${getAvatar(activeMatch.p2, 32)}<span class="font-bold text-white text-xs mt-1 truncate w-full text-center clickable-name" onclick="event.stopPropagation(); showProfileModal('${activeMatch.p2}')">${activeMatch.p2} ${getPlayerBadges(activeMatch.p2)}</span><div class="bg-yellow-900/50 text-yellow-400 text-[9px] px-2 py-0.5 rounded border border-yellow-700/50 mt-1 ${voteBtnStyle}">Votar</div></div></div><div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex mt-1"><div class="h-full bg-cyan-500 transition-all duration-500" style="width: ${p1Pct}%"></div><div class="h-full bg-yellow-500 flex-1"></div></div></div>`;
    } else { container.classList.add('hidden'); }
}

window.openLiveMatch = function (rIdx, mIdx) { const match = gameState.rounds[rIdx].matches[mIdx]; if (match.isBye) return; liveMatchIndices = { rIdx, mIdx }; document.getElementById('liveP1Name').textContent = match.p1; document.getElementById('liveP1Avatar').innerHTML = getAvatar(match.p1, 64); document.getElementById('liveP1Nick').textContent = gameState.playerMeta[match.p1]?.nickname || ""; document.getElementById('liveP2Name').textContent = match.p2; document.getElementById('liveP2Avatar').innerHTML = getAvatar(match.p2, 64); document.getElementById('liveP2Nick').textContent = gameState.playerMeta[match.p2]?.nickname || ""; updateLiveMatchUI(match); document.getElementById('liveMatchModal').classList.remove('hidden'); }
window.closeLiveMatch = function () { document.getElementById('liveMatchModal').classList.add('hidden'); liveMatchIndices = null; }
function updateLiveMatchUI(match) { document.getElementById('liveP1Score').textContent = match.score1; document.getElementById('liveP2Score').textContent = match.score2; const matchKey = `${currentRoomId}_r${liveMatchIndices.rIdx}m${liveMatchIndices.mIdx}`; const votes = gameState.votes[matchKey] || { p1: 0, p2: 0 }; const totalVotes = votes.p1 + votes.p2; const p1Pct = totalVotes === 0 ? 50 : (votes.p1 / totalVotes) * 100; const p2Pct = totalVotes === 0 ? 50 : (votes.p2 / totalVotes) * 100; document.getElementById('barVoteP1').style.width = `${p1Pct}%`; document.getElementById('textVoteP1').textContent = totalVotes === 0 ? '50%' : `${Math.round(p1Pct)}%`; document.getElementById('textVoteP2').textContent = totalVotes === 0 ? '50%' : `${Math.round(p2Pct)}%`; const amIPlaying = match.p1 === currentUserIdentity || match.p2 === currentUserIdentity; if (amIPlaying) { document.getElementById('voteBtnP1').classList.add('hidden'); document.getElementById('voteBtnP2').classList.add('hidden'); } else { document.getElementById('voteBtnP1').classList.remove('hidden'); document.getElementById('voteBtnP2').classList.remove('hidden'); } const target = gameState.targetScore || 11; const lead = Math.abs(match.score1 - match.score2); const maxScore = Math.max(match.score1, match.score2); const isWin = maxScore >= target && lead >= 2; const p1Area = document.getElementById('liveAreaP1'); const p2Area = document.getElementById('liveAreaP2'); if (isWin) { p1Area.classList.add('locked-add'); p2Area.classList.add('locked-add'); } else { p1Area.classList.remove('locked-add'); p2Area.classList.remove('locked-add'); } const finishBtn = document.getElementById('liveFinishBtnContainer'); if (isWin && !match.winner) { finishBtn.classList.remove('hidden'); if (maxScore === target || lead === 2) confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } }); } else { finishBtn.classList.add('hidden'); } const totalPoints = match.score1 + match.score2; let serverP1 = true; if (maxScore >= (target - 1) && match.score1 >= (target - 1) && match.score2 >= (target - 1)) { serverP1 = (totalPoints % 2) === 0; } else { const changeRate = target >= 21 ? 5 : 2; serverP1 = Math.floor(totalPoints / changeRate) % 2 === 0; } if (serverP1) { document.getElementById('liveP1Serve').classList.remove('hidden'); document.getElementById('liveP2Serve').classList.add('hidden'); } else { document.getElementById('liveP1Serve').classList.add('hidden'); document.getElementById('liveP2Serve').classList.remove('hidden'); } }
window.voteFor = async function (rIdx, mIdx, playerNum) { let r = rIdx, m = mIdx, p = playerNum; if (arguments.length === 1) { if (!liveMatchIndices) return; r = liveMatchIndices.rIdx; m = liveMatchIndices.mIdx; p = arguments[0]; } const match = gameState.rounds[r].matches[m]; if (match.p1 === currentUserIdentity || match.p2 === currentUserIdentity) return showToast("No puedes votar en tu propio partido", "error"); const matchKey = `${currentRoomId}_r${r}m${m}`; const voteScope = gameState.activeSince || gameState.createdAt || "legacy"; const localVoteKey = `voted_${matchKey}_${voteScope}`; if (localStorage.getItem(localVoteKey)) return showToast("Ya votaste en este partido", "error"); const votes = gameState.votes || {}; if (!votes[matchKey]) votes[matchKey] = { p1: 0, p2: 0 }; if (p === 1) votes[matchKey].p1++; else votes[matchKey].p2++; await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), { votes: votes }); localStorage.setItem(localVoteKey, "true"); showToast("Voto registrado!"); playSound('ping', 0.05); }
window.toggleReady = async function () {
    if (!currentUserIdentity) return showToast("Primero elige tu identidad", "error");
    const readyPlayers = { ...getReadyPlayers() };
    readyPlayers[currentUserIdentity] = !readyPlayers[currentUserIdentity];
    await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), { readyPlayers });
};
window.liveScore = async function (playerNum, delta) { if (!liveMatchIndices) return; const { rIdx, mIdx } = liveMatchIndices; const rounds = JSON.parse(JSON.stringify(gameState.rounds)); const match = rounds[rIdx].matches[mIdx]; if (match.winner && delta > 0) return; if (match.winner && delta < 0) { match.winner = null; if (rounds.length === rIdx + 1) gameState.champion = null; } const target = gameState.targetScore || 11; const currentMax = Math.max(match.score1, match.score2); const lead = Math.abs(match.score1 - match.score2); const isAlreadyWon = currentMax >= target && lead >= 2; if (delta > 0 && isAlreadyWon && !match.winner) return; let newVal = (playerNum === 1 ? match.score1 : match.score2) + delta; if (newVal < 0) newVal = 0; if (playerNum === 1) match.score1 = newVal; else match.score2 = newVal; if (delta > 0) playSound('ping'); await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), { rounds, champion: gameState.champion }); }
window.finishLiveMatch = function () { if (!liveMatchIndices) return; finishMatch(liveMatchIndices.rIdx, liveMatchIndices.mIdx); closeLiveMatch(); }
window.addPlayer = async function () { const name = document.getElementById('playerInput').value.trim(); const nick = document.getElementById('playerNickInput').value.trim(); if (!name || gameState.players.includes(name)) return; const updateData = { players: arrayUnion(name) }; if (nick) updateData[`playerMeta.${name}`] = { nickname: nick }; await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), updateData); document.getElementById('playerInput').value = ''; document.getElementById('playerNickInput').value = ''; playSound('ping'); }
window.removePlayer = async function (idx) { const newP = [...gameState.players]; newP.splice(idx, 1); await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), { players: newP }); }

window.startTournament = async function () {
    if (gameState.players.length < 2) return;
    const readyPlayers = getReadyPlayers();
    const allReady = gameState.players.every(p => !!readyPlayers[p]);
    if (!allReady) return showToast("Faltan jugadores por marcarse como listos", "error");
    const shuffled = [...gameState.players].sort(() => Math.random() - 0.5);
    const matches = [];
    while (shuffled.length > 0) {
        const p1 = shuffled.pop(); const p2 = shuffled.length > 0 ? shuffled.pop() : null;
        matches.push({ p1, p2, score1: 0, score2: 0, winner: p2 ? null : p1, isBye: !p2, status: 'pending' });
    }
    await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), { rounds: [{ matches }], active: true, activeSince: Date.now(), champion: null, readyPlayers: {} });
    playSound('win', 0.2);
}

window.updateScore = async function (rIdx, mIdx, pNum, val) { const rounds = JSON.parse(JSON.stringify(gameState.rounds)); const match = rounds[rIdx].matches[mIdx]; if (pNum === 1) match.score1 = parseInt(val); else match.score2 = parseInt(val); await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), { rounds }); }

window.finishMatch = async function (rIdx, mIdx) {
    const rounds = JSON.parse(JSON.stringify(gameState.rounds));
    const matches = rounds[rIdx].matches;
    const match = matches[mIdx];
    const target = gameState.targetScore || 11;
    const lead = Math.abs(match.score1 - match.score2);
    const maxScore = Math.max(match.score1, match.score2);

    if (match.score1 === match.score2) return showToast("No empates", "error");
    if (maxScore < target || lead < 2) return showToast(`Debe llegar a ${target} con 2 de diferencia`, "error");
    match.winner = match.score1 > match.score2 ? match.p1 : match.p2;
    playSound('win');

    let champ = null;
    if (matches.every(m => m.winner)) {
        const totalRounds = Math.ceil(Math.log2(gameState.players.length));

        // If this is the calculated final round, the winner of the first match (Final) is the champion.
        if (rIdx === totalRounds - 1) {
            champ = matches[0].winner;
        }
        else if (!rounds[rIdx + 1]) {
            // Logic for generating next round
            const nextMatches = [];

            // Check if this was Semi-Finals (2 matches)
            if (matches.length === 2) {
                const winners = [];
                const losers = [];
                matches.forEach(m => {
                    winners.push(m.winner);
                    // Identify loser
                    losers.push(m.p1 === m.winner ? m.p2 : m.p1);
                });

                // Match 0: FINAL (Winner vs Winner)
                nextMatches.push({ p1: winners[0], p2: winners[1], score1: 0, score2: 0, winner: null, isBye: false, status: 'pending' });

                // Match 1: 3rd PLACE (Loser vs Loser)
                // If one was a bye (null), the other gets 3rd place automatically (Bye)
                const l1 = losers[0] || null;
                const l2 = losers[1] || null;

                // If both real losers exist, normal match. If one is null (came from bye), it's a bye match.
                const isBye3rd = (!l1 || !l2);
                // If isBye3rd, winner is the non-null one.
                const winner3rd = isBye3rd ? (l1 || l2) : null;

                nextMatches.push({
                    p1: l1, p2: l2, score1: 0, score2: 0,
                    winner: winner3rd, isBye: isBye3rd, status: 'pending', isThirdPlace: true
                });

            } else {
                // Standard progression (Quarters -> Semis, etc)
                const winners = matches.map(m => m.winner);
                for (let i = 0; i < winners.length; i += 2) {
                    const p1 = winners[i], p2 = winners[i + 1] || null;
                    nextMatches.push({ p1, p2, score1: 0, score2: 0, winner: p2 ? null : p1, isBye: !p2, status: 'pending' });
                }
            }
            rounds.push({ matches: nextMatches });
        }
    }
    await updateDoc(doc(db, window.DB_PATH_PREFIX, currentRoomId), { rounds, champion: champ });
}

function getPlayerBadges(name) {
    let played = 0, won = 0, streak = 0, currentStreak = 0, wallWins = 0;
    const target = gameState.targetScore || 11;
    if (gameState.rounds) {
        gameState.rounds.forEach(r => {
            r.matches.forEach(m => {
                if (m.isBye) return;
                if ((m.score1 > 0 || m.score2 > 0) && (m.p1 === name || m.p2 === name)) played++;
                if (m.winner === name) {
                    won++; currentStreak++; if (currentStreak > streak) streak = currentStreak;
                    const oppScore = m.p1 === name ? m.score2 : m.score1;
                    if (oppScore < (target / 2)) wallWins++;
                }
                else if (m.winner && (m.p1 === name || m.p2 === name)) currentStreak = 0;
            });
        });
    }
    let html = '';
    if (streak >= 2) html += '<i class="fas fa-fire text-orange-500 bracket-medal" title="On Fire"></i>';
    if (wallWins >= 1) html += '<i class="fas fa-shield-alt text-blue-400 bracket-medal" title="La Muralla"></i>';
    if (won >= 1) html += '<i class="fas fa-skull text-red-400 bracket-medal" title="Primera Sangre"></i>';
    return html;
}


window.showStatsModal = function () { document.getElementById('statsModal').classList.remove('hidden'); calculateAndRenderStats(); }
window.closeStatsModal = function () { document.getElementById('statsModal').classList.add('hidden'); }
function calculateAndRenderStats() {
    const stats = {};
    gameState.players.forEach(p => { stats[p] = { name: p, played: 0, won: 0, diff: 0 }; });
    gameState.rounds.forEach(round => { round.matches.forEach(m => { if (m.isBye) return; if (m.score1 > 0 || m.score2 > 0 || m.winner) { if (stats[m.p1]) { stats[m.p1].played++; stats[m.p1].diff += (m.score1 - m.score2); } if (m.p2 && stats[m.p2]) { stats[m.p2].played++; stats[m.p2].diff += (m.score2 - m.score1); } } if (m.winner && stats[m.winner]) stats[m.winner].won++; }); });
    const sortedStats = Object.values(stats).sort((a, b) => { if (a.won !== b.won) return b.won - a.won; return b.diff - a.diff; });
    const tbody = document.getElementById('statsTableBody'); tbody.innerHTML = '';
    sortedStats.forEach((s, i) => { const isLeader = i === 0 && s.won > 0; const rowClass = isLeader ? 'bg-yellow-500/20 text-yellow-200' : 'border-b border-slate-700/30 text-slate-300'; const isMe = s.name === currentUserIdentity; tbody.innerHTML += `<tr class="${rowClass}"> <td class="py-2 pl-2 font-mono text-slate-500/70">${i + 1}</td> <td class="py-2 flex items-center gap-2 clickable-name" onclick="showProfileModal('${s.name}')">${getAvatar(s.name, 24)} <span class="${isLeader ? 'font-bold' : ''} ${isMe ? 'me-highlight' : ''}">${s.name} ${isLeader ? '[LIDER]' : ''}</span></td> <td class="py-2 text-center font-mono">${s.played}</td> <td class="py-2 text-center font-mono font-bold">${s.won}</td> <td class="py-2 text-center font-mono text-xs ${s.diff > 0 ? 'text-green-400' : 'text-red-400'}">${s.diff > 0 ? '+' : ''}${s.diff}</td> </tr>`; });
}
window.copyRoomCode = function () { const code = document.getElementById('roomCodeDisplay').textContent; navigator.clipboard.writeText(code).then(() => showToast("Codigo copiado!")); }
window.toggleFullScreen = function () { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(e => console.log(e)); else if (document.exitFullscreen) document.exitFullscreen(); }
window.handleEnter = (e) => { if (e.key === 'Enter') addPlayer(); };
window.showResetModal = () => document.getElementById('resetModal').classList.remove('hidden');
window.closeResetModal = () => document.getElementById('resetModal').classList.add('hidden');
window.closeWinnerModal = () => { document.getElementById('winnerAnnouncement').classList.add('hidden'); winnerAcknowledged = true; };
window.showWinnerModal = () => { winnerAcknowledged = false; document.getElementById('winnerAnnouncement').classList.remove('hidden'); };

function renderBracket() {
    const container = document.getElementById('roundsContainer'); container.innerHTML = '';
    gameState.rounds.forEach((r, rIdx) => {
        const roundDiv = document.createElement('div'); roundDiv.className = "min-w-[85vw] md:min-w-[350px] flex flex-col gap-3 snap-center shrink-0 pb-4";
        roundDiv.innerHTML = `<h3 class="text-center font-bold text-blue-300 bg-slate-800/80 backdrop-blur-sm py-2 rounded mb-2 sticky top-0 z-10">Ronda ${rIdx + 1}</h3>`;
        r.matches.forEach((m, mIdx) => {
            const done = m.winner !== null; const p1W = m.winner === m.p1; const p2W = m.winner === m.p2;
            let justWonClass = ""; if (done && previousRounds && previousRounds[rIdx]?.matches[mIdx] && !previousRounds[rIdx].matches[mIdx].winner) justWonClass = "just-won";
            let statusBadge = ''; if (done) statusBadge = `<span class="badge-status status-done">FINALIZADO</span>`; else if (!m.isBye && (m.score1 > 0 || m.score2 > 0 || m.status === 'ready')) statusBadge = `<span class="badge-status status-live">EN JUEGO</span>`; else if (!m.isBye) statusBadge = `<span class="badge-status status-new">SIN INICIAR</span>`;

            // Special label for 3rd place
            let matchLabel = "";
            const totalRounds = Math.ceil(Math.log2(gameState.players.length));
            if (rIdx === totalRounds - 1 && gameState.rounds[rIdx].matches.length === 2) {
                if (mIdx === 0) matchLabel = '<div class="text-center text-[10px] text-yellow-400 font-bold mb-1 tracking-widest">GRAN FINAL</div>';
                if (mIdx === 1) matchLabel = '<div class="text-center text-[10px] text-slate-400 font-bold mb-1 tracking-widest">3ER PUESTO</div>';
            }

            let html = `<div class="glass-panel rounded-lg p-3 border-l-4 ${done ? 'border-l-yellow-400' : 'border-l-blue-500'} relative ${justWonClass}">`;
            html += matchLabel;

            if (!m.isBye) html += `<div class="flex justify-end mb-2">${statusBadge}</div>`;
            if (m.isBye) { html += `<div class="text-center py-4"><div class="font-bold text-white flex justify-center items-center gap-2">${getAvatar(m.p1, 32)} <span class="${m.p1 === currentUserIdentity ? 'me-highlight' : ''} clickable-name" onclick="showProfileModal('${m.p1}')">${m.p1}</span></div><div class="text-xs text-slate-400 mt-1">BYE</div></div>`; }
            else {
                const n1 = gameState.playerMeta[m.p1]?.nickname || ""; const n2 = gameState.playerMeta[m.p2]?.nickname || "";
                html += `<div class="flex justify-between items-center mb-2 ${p1W ? 'text-yellow-400 font-bold' : 'text-white'}"><span class="truncate w-32 text-sm"><div class="flex items-center gap-2">${getAvatar(m.p1)} <span class="${m.p1 === currentUserIdentity ? 'me-highlight' : ''} clickable-name" onclick="showProfileModal('${m.p1}')">${m.p1} ${getPlayerBadges(m.p1)}</span></div>${n1 ? `<div class="text-[10px] text-slate-400/60 ml-8 italic">${n1}</div>` : ''}</span><span class="font-mono font-bold text-xl">${m.score1}</span></div>`;
                html += `<div class="flex justify-between items-center mt-2 ${p2W ? 'text-yellow-400 font-bold' : 'text-white'}"><span class="truncate w-32 text-sm"><div class="flex items-center gap-2">${getAvatar(m.p2 || '?')} <span class="${m.p2 === currentUserIdentity ? 'me-highlight' : ''} clickable-name" onclick="showProfileModal('${m.p2}')">${m.p2 || '?'} ${getPlayerBadges(m.p2)}</span></div>${n2 ? `<div class="text-[10px] text-slate-400/60 ml-8 italic">${n2}</div>` : ''}</span><span class="font-mono font-bold text-xl">${m.score2}</span></div><div class="flex gap-2 mt-3">`;
                if (!done && m.p2) {
                    const isCreator = auth.currentUser && gameState.creator === auth.currentUser.uid;
                    if (m.status !== 'ready' && m.score1 === 0 && m.score2 === 0 && isCreator) { html += `<button onclick="callToPlay(${rIdx},${mIdx})" class="flex-1 bg-blue-600/50 hover:bg-blue-500 text-blue-200 border border-blue-500/30 py-2 rounded text-xs font-bold transition-colors"><i class="fas fa-bullhorn mr-1"></i> LLAMAR</button>`; }
                    else { html += `<button onclick="openLiveMatch(${rIdx},${mIdx})" class="flex-1 bg-blue-800/50 hover:bg-blue-700 text-blue-300 border border-blue-600/30 py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-2"><i class="fas fa-gamepad"></i> ARBITRAR</button>`; }
                }
                else if (done) html += `<div class="w-full text-center text-xs text-yellow-500/70 font-bold py-1">GANADOR: ${m.winner}</div>`;
                html += `</div>`;
            }
            html += `</div>`; roundDiv.innerHTML += html;
        });
        container.appendChild(roundDiv);
    });
}

function renderPlayerList() {
    const list = document.getElementById('playerList'); list.innerHTML = '';
    const readyPlayers = getReadyPlayers();
    const readyCount = gameState.players.filter(p => !!readyPlayers[p]).length;
    gameState.players.forEach((p, i) => {
        const nick = gameState.playerMeta[p]?.nickname || ""; const isMe = p === currentUserIdentity; const isCreator = auth.currentUser && gameState.creator === auth.currentUser.uid; const removeBtn = isCreator ? `<button onclick="removePlayer(${i})" class="text-red-400 hover:bg-red-500/20 p-1 rounded"><i class="fas fa-times"></i></button>` : '';
        const readyBadge = readyPlayers[p] ? '<span class="text-[10px] text-emerald-300 border border-emerald-400/40 px-1 py-0.5 rounded">LISTO</span>' : '<span class="text-[10px] text-slate-400 border border-slate-600/40 px-1 py-0.5 rounded">PENDIENTE</span>';
        list.innerHTML += `<li class="flex justify-between items-center bg-slate-800/40 px-3 py-2 rounded border border-blue-900/50 animate-fade-in"><div><span class="text-white font-medium flex items-center gap-2 clickable-name" onclick="showProfileModal('${p}')">${getAvatar(p, 32)} <span class="${isMe ? 'me-highlight' : ''}">${p}</span> ${readyBadge}</span>${nick ? `<div class="text-[10px] text-slate-400 italic ml-10">${nick}</div>` : ''}</div>${removeBtn}</li>`;
    });
    document.getElementById('playerCount').textContent = `${gameState.players.length} Jugadores`;
    const allReady = gameState.players.length >= 2 && gameState.players.every(p => !!readyPlayers[p]);
    document.getElementById('readyCount').textContent = `${readyCount}/${gameState.players.length} listos`;
    const readyBtn = document.getElementById('readyBtn');
    if (currentUserIdentity && readyPlayers[currentUserIdentity]) readyBtn.textContent = "NO LISTO";
    else readyBtn.textContent = "LISTO";
    document.getElementById('startBtn').disabled = !allReady;
}

initApp();


