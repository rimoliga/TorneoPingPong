export function buildNextMatchesFromRound(matches) {
    const nextMatches = [];
    if (matches.length === 2) {
        const winners = [];
        const losers = [];
        matches.forEach((match) => {
            winners.push(match.winner);
            losers.push(match.p1 === match.winner ? match.p2 : match.p1);
        });

        nextMatches.push({
            p1: winners[0],
            p2: winners[1],
            score1: 0,
            score2: 0,
            winner: null,
            isBye: false,
            status: "pending",
        });

        const l1 = losers[0] || null;
        const l2 = losers[1] || null;
        const isBye3rd = !l1 || !l2;
        const winner3rd = isBye3rd ? (l1 || l2) : null;

        nextMatches.push({
            p1: l1,
            p2: l2,
            score1: 0,
            score2: 0,
            winner: winner3rd,
            isBye: isBye3rd,
            status: "pending",
            isThirdPlace: true,
        });
        return nextMatches;
    }

    const winners = matches.map((match) => match.winner);
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
    return nextMatches;
}

export function applyRoundProgression(rounds, playersCount, roundIdx) {
    const matches = rounds[roundIdx]?.matches || [];
    let champion = null;
    if (!matches.every((match) => match.winner)) {
        return { rounds, champion };
    }

    const totalRounds = Math.ceil(Math.log2(playersCount));
    if (roundIdx === totalRounds - 1) {
        champion = matches[0]?.winner || null;
        return { rounds, champion };
    }

    if (!rounds[roundIdx + 1]) {
        rounds.push({ matches: buildNextMatchesFromRound(matches) });
    }
    return { rounds, champion };
}
