export function calculateTournamentStats(players, rounds) {
    const stats = {};
    (players || []).forEach((player) => {
        stats[player] = { name: player, played: 0, won: 0, diff: 0 };
    });

    (rounds || []).forEach((round) => {
        (round.matches || []).forEach((match) => {
            if (match.isBye) return;
            if (match.score1 > 0 || match.score2 > 0 || match.winner) {
                if (stats[match.p1]) {
                    stats[match.p1].played++;
                    stats[match.p1].diff += (match.score1 - match.score2);
                }
                if (match.p2 && stats[match.p2]) {
                    stats[match.p2].played++;
                    stats[match.p2].diff += (match.score2 - match.score1);
                }
            }
            if (match.winner && stats[match.winner]) stats[match.winner].won++;
        });
    });

    return Object.values(stats).sort((a, b) => {
        if (a.won !== b.won) return b.won - a.won;
        return b.diff - a.diff;
    });
}

export function buildShareableTournamentSummary({
    tournamentName,
    targetScore,
    champion,
    players,
    rounds,
    roomCode,
    maxRows = 4,
}) {
    const safeName = (tournamentName || "Torneo sin nombre").trim();
    const safeTarget = Number.isFinite(Number(targetScore)) && Number(targetScore) > 0 ? Math.floor(Number(targetScore)) : 11;
    const safeChampion = champion || "Por definir";
    const safeRoom = roomCode || "----";
    const rows = calculateTournamentStats(players || [], rounds || []).slice(0, Math.max(1, maxRows));

    const lines = [
        `Torneo: ${safeName}`,
        `Campeon: ${safeChampion}`,
        `Formato: a ${safeTarget} puntos`,
        `Sala: ${safeRoom}`,
        "",
        "Tabla final:",
    ];
    rows.forEach((row, idx) => {
        const diff = row.diff > 0 ? `+${row.diff}` : `${row.diff}`;
        lines.push(`${idx + 1}. ${row.name} | PG ${row.won} | PJ ${row.played} | DIF ${diff}`);
    });

    return lines.join("\n");
}
