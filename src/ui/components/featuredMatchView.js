function escapeForOnclick(str) { return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

export function findFeaturedMatch(rounds) {
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
}

export function renderFeaturedMatchCard({
    container,
    featured,
    currentRoomId,
    votesByMatch,
    currentUserIdentity,
    getAvatar,
    getPlayerBadges,
}) {
    if (!container) return;
    if (!featured) {
        container.classList.add("hidden");
        return;
    }

    const { match, indices } = featured;
    container.classList.remove("hidden");
    const matchKey = `${currentRoomId}_r${indices.r}m${indices.m}`;
    const votes = votesByMatch?.[matchKey] || { p1: 0, p2: 0 };
    const totalVotes = votes.p1 + votes.p2;
    const p1Pct = totalVotes === 0 ? 50 : (votes.p1 / totalVotes) * 100;
    const amIPlaying = match.p1 === currentUserIdentity || match.p2 === currentUserIdentity;
    const voteClass = amIPlaying ? "" : "cursor-pointer hover:opacity-80 transition-opacity";
    const voteClickAction = amIPlaying ? "void(" : `voteFor(${indices.r},${indices.m},`;
    const voteBtnStyle = amIPlaying ? "invisible" : "";

    container.innerHTML = `<div class="w-full featured-card rounded-xl p-3 pt-6 relative overflow-hidden"><div class="absolute top-0 left-0 w-full h-1 bg-yellow-400 animate-pulse"></div><div class="text-[10px] font-bold text-yellow-400 absolute top-1 left-1/2 transform -translate-x-1/2 tracking-widest uppercase">EN JUEGO</div><div class="flex justify-between items-center mb-2"><div class="flex flex-col items-center w-1/3 ${voteClass}" onclick="${voteClickAction}1)">${getAvatar(match.p1, 32)}<span class="font-bold text-white text-xs mt-1 truncate w-full text-center clickable-name" onclick="event.stopPropagation(); showProfileModal('${escapeForOnclick(match.p1)}')">${match.p1} ${getPlayerBadges(match.p1)}</span><div class="bg-cyan-900/50 text-cyan-400 text-[9px] px-2 py-0.5 rounded border border-cyan-700/50 mt-1 ${voteBtnStyle}">Votar</div></div><div class="flex flex-col items-center justify-center w-1/3 z-10"><div class="text-3xl font-mono font-bold text-white leading-none">${match.score1}-${match.score2}</div><button onclick="openLiveMatch(${indices.r},${indices.m})" class="mt-1 bg-yellow-500 hover:bg-yellow-400 text-black text-[10px] font-bold px-3 py-1 rounded-full shadow-lg animate-bounce">ARBITRAR</button></div><div class="flex flex-col items-center w-1/3 ${voteClass}" onclick="${voteClickAction}2)">${getAvatar(match.p2, 32)}<span class="font-bold text-white text-xs mt-1 truncate w-full text-center clickable-name" onclick="event.stopPropagation(); showProfileModal('${escapeForOnclick(match.p2)}')">${match.p2} ${getPlayerBadges(match.p2)}</span><div class="bg-yellow-900/50 text-yellow-400 text-[9px] px-2 py-0.5 rounded border border-yellow-700/50 mt-1 ${voteBtnStyle}">Votar</div></div></div><div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex mt-1"><div class="h-full bg-cyan-500 transition-all duration-500" style="width: ${p1Pct}%"></div><div class="h-full bg-yellow-500 flex-1"></div></div></div>`;
}
