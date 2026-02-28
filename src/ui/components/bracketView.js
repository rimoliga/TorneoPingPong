function escapeForOnclick(str) { return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

export function renderBracketView({
    container,
    rounds,
    players,
    playerMeta,
    previousRounds,
    currentUserIdentity,
    isRoomAdmin,
    getAvatar,
    getPlayerBadges,
}) {
    if (!container) return;
    container.innerHTML = "";

    (rounds || []).forEach((round, roundIdx) => {
        const roundDiv = document.createElement("div");
        roundDiv.className = "min-w-[85vw] md:min-w-[350px] flex flex-col gap-3 snap-center shrink-0 pb-4";
        roundDiv.innerHTML = `<h3 class="text-center font-bold text-blue-300 bg-slate-800/80 backdrop-blur-sm py-2 rounded mb-2 sticky top-0 z-10">Ronda ${roundIdx + 1}</h3>`;

        (round.matches || []).forEach((match, matchIdx) => {
            const done = match.winner !== null;
            const p1W = match.winner === match.p1;
            const p2W = match.winner === match.p2;
            const justWonClass = done && previousRounds && previousRounds[roundIdx]?.matches[matchIdx] && !previousRounds[roundIdx].matches[matchIdx].winner ? "just-won" : "";
            let statusBadge = "";
            if (done) statusBadge = `<span class="badge-status status-done">FINALIZADO</span>`;
            else if (!match.isBye && (match.score1 > 0 || match.score2 > 0 || match.status === "ready")) statusBadge = `<span class="badge-status status-live">EN JUEGO</span>`;
            else if (!match.isBye) statusBadge = `<span class="badge-status status-new">SIN INICIAR</span>`;

            let matchLabel = "";
            const totalRounds = Math.ceil(Math.log2((players || []).length));
            if (roundIdx === totalRounds - 1 && (rounds[roundIdx]?.matches || []).length === 2) {
                if (matchIdx === 0) matchLabel = '<div class="text-center text-[10px] text-yellow-400 font-bold mb-1 tracking-widest">GRAN FINAL</div>';
                if (matchIdx === 1) matchLabel = '<div class="text-center text-[10px] text-slate-400 font-bold mb-1 tracking-widest">3ER PUESTO</div>';
            }

            let html = `<div class="glass-panel rounded-lg p-3 border-l-4 ${done ? "border-l-yellow-400" : "border-l-blue-500"} relative ${justWonClass}">`;
            html += matchLabel;
            if (!match.isBye) html += `<div class="flex justify-end mb-2">${statusBadge}</div>`;

            if (match.isBye) {
                html += `<div class="text-center py-4"><div class="font-bold text-white flex justify-center items-center gap-2">${getAvatar(match.p1, 32)} <span class="${match.p1 === currentUserIdentity ? "me-highlight" : ""} clickable-name" onclick="showProfileModal('${escapeForOnclick(match.p1)}')">${match.p1}</span></div><div class="text-xs text-slate-400 mt-1">BYE</div></div>`;
            } else {
                const n1 = playerMeta?.[match.p1]?.nickname || "";
                const n2 = playerMeta?.[match.p2]?.nickname || "";
                html += `<div class="flex justify-between items-center mb-2 ${p1W ? "text-yellow-400 font-bold" : "text-white"}"><span class="truncate w-32 text-sm"><div class="flex items-center gap-2">${getAvatar(match.p1)} <span class="${match.p1 === currentUserIdentity ? "me-highlight" : ""} clickable-name" onclick="showProfileModal('${escapeForOnclick(match.p1)}')">${match.p1} ${getPlayerBadges(match.p1)}</span></div>${n1 ? `<div class="text-[10px] text-slate-400/60 ml-8 italic">${n1}</div>` : ""}</span><span class="font-mono font-bold text-xl">${match.score1}</span></div>`;
                html += `<div class="flex justify-between items-center mt-2 ${p2W ? "text-yellow-400 font-bold" : "text-white"}"><span class="truncate w-32 text-sm"><div class="flex items-center gap-2">${getAvatar(match.p2 || "?")} <span class="${match.p2 === currentUserIdentity ? "me-highlight" : ""} clickable-name" onclick="showProfileModal('${escapeForOnclick(match.p2)}')">${match.p2 || "?"} ${getPlayerBadges(match.p2)}</span></div>${n2 ? `<div class="text-[10px] text-slate-400/60 ml-8 italic">${n2}</div>` : ""}</span><span class="font-mono font-bold text-xl">${match.score2}</span></div><div class="flex gap-2 mt-3">`;
                if (!done && match.p2) {
                    if (match.status !== "ready" && match.score1 === 0 && match.score2 === 0 && isRoomAdmin) {
                        html += `<button onclick="callToPlay(${roundIdx},${matchIdx})" class="flex-1 bg-blue-600/50 hover:bg-blue-500 text-blue-200 border border-blue-500/30 py-2 rounded text-xs font-bold transition-colors"><i class="fas fa-bullhorn mr-1"></i> LLAMAR</button>`;
                    } else {
                        html += `<button onclick="openLiveMatch(${roundIdx},${matchIdx})" class="flex-1 bg-blue-800/50 hover:bg-blue-700 text-blue-300 border border-blue-600/30 py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-2"><i class="fas fa-gamepad"></i> ARBITRAR</button>`;
                    }
                } else if (done) {
                    html += `<div class="w-full text-center text-xs text-yellow-500/70 font-bold py-1">GANADOR: ${match.winner}</div>`;
                }
                html += "</div>";
            }

            html += "</div>";
            roundDiv.innerHTML += html;
        });

        container.appendChild(roundDiv);
    });
}
