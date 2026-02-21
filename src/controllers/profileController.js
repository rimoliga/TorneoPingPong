export function calculatePlayerPerformance(rounds, playerName, targetScore) {
    let played = 0;
    let won = 0;
    let streak = 0;
    let currentStreak = 0;
    let wallWins = 0;
    (rounds || []).forEach((round) => {
        (round.matches || []).forEach((match) => {
            if (match.isBye) return;
            const participated = match.p1 === playerName || match.p2 === playerName;
            if ((match.score1 > 0 || match.score2 > 0) && participated) played++;
            if (match.winner === playerName) {
                won++;
                currentStreak++;
                if (currentStreak > streak) streak = currentStreak;
                const oppScore = match.p1 === playerName ? match.score2 : match.score1;
                if (oppScore < (targetScore / 2)) wallWins++;
            } else if (match.winner && participated) {
                currentStreak = 0;
            }
        });
    });
    const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
    return { played, won, streak, wallWins, winRate };
}

export function getGlobalPlayerStats(globalStats, playerName) {
    return (globalStats && globalStats[playerName])
        ? globalStats[playerName]
        : { played: 0, won: 0, tourneys: 0 };
}

export function getProfileBadgeSets(perf, globalStats) {
    const currentBadges = [
        { icon: "F", name: "On Fire", desc: "Racha 2+", unlocked: perf.streak >= 2 },
        { icon: "W", name: "Muro", desc: "Rival <50%", unlocked: perf.wallWins >= 1 },
        { icon: "S", name: "1ra Sangre", desc: "Ganar 1", unlocked: perf.won >= 1 },
        { icon: "D", name: "Debut", desc: "Jugar 1", unlocked: perf.played >= 1 },
    ];
    const globalBadges = [
        { icon: "L", name: "Leyenda", desc: "5+ Copas", unlocked: globalStats.tourneys >= 5 },
        { icon: "V", name: "Veterano", desc: "20+ Partidos", unlocked: globalStats.played >= 20 },
        { icon: "N", name: "Sniper", desc: ">60% Win", unlocked: globalStats.played > 10 && (globalStats.won / globalStats.played) > 0.6 },
        { icon: "P", name: "Pro", desc: "1+ Copa", unlocked: globalStats.tourneys >= 1 },
    ];
    return { currentBadges, globalBadges };
}

export function buildBracketBadgesHtml(perf) {
    let html = "";
    if (perf.streak >= 2) html += '<i class="fas fa-fire text-orange-500 bracket-medal" title="On Fire"></i>';
    if (perf.wallWins >= 1) html += '<i class="fas fa-shield-alt text-blue-400 bracket-medal" title="La Muralla"></i>';
    if (perf.won >= 1) html += '<i class="fas fa-skull text-red-400 bracket-medal" title="Primera Sangre"></i>';
    return html;
}
