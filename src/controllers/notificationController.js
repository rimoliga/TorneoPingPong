export function collectMyTurnNotifications(rounds, currentUserIdentity, notifiedMatches) {
    if (!currentUserIdentity) return [];
    const nextIds = [];
    (rounds || []).forEach((round, rIdx) => {
        (round.matches || []).forEach((match, mIdx) => {
            if (match.isBye || match.winner) return;
            if (match.p1 !== currentUserIdentity && match.p2 !== currentUserIdentity) return;
            const matchId = `r${rIdx}m${mIdx}`;
            const shouldNotify = match.status === "ready" || ((match.score1 + match.score2) > 0);
            if (shouldNotify && !notifiedMatches.has(matchId)) nextIds.push(matchId);
        });
    });
    return nextIds;
}

export function detectNewWinners(previousRounds, newRounds) {
    const winners = [];
    (newRounds || []).forEach((round, rIdx) => {
        (round.matches || []).forEach((match, mIdx) => {
            const oldMatch = previousRounds?.[rIdx]?.matches?.[mIdx];
            if (oldMatch && !oldMatch.winner && match.winner) winners.push(match.winner);
        });
    });
    return winners;
}
