export function hasTwoPointLead(score1, score2) {
    return Math.abs(score1 - score2) >= 2;
}

export function isWinningState(score1, score2, targetScore) {
    const maxScore = Math.max(score1, score2);
    return maxScore >= targetScore && hasTwoPointLead(score1, score2);
}

export function canFinalizeMatch(score1, score2, targetScore) {
    if (score1 === score2) return false;
    return isWinningState(score1, score2, targetScore);
}

export function getWinnerByScore(player1, player2, score1, score2) {
    if (score1 === score2) return null;
    return score1 > score2 ? player1 : player2;
}

export function getCloseMatchHint(score1, score2, targetScore) {
    const safeTarget = Number.isFinite(Number(targetScore)) && Number(targetScore) > 0 ? Math.floor(Number(targetScore)) : 11;
    if (isWinningState(score1, score2, safeTarget)) {
        return { canClose: true, text: "Listo para finalizar el partido" };
    }

    const maxScore = Math.max(score1, score2);
    const minScore = Math.min(score1, score2);
    const pointsToTarget = Math.max(0, safeTarget - maxScore);
    if (pointsToTarget > 0) {
        return {
            canClose: false,
            text: `Faltan ${pointsToTarget} punto(s) para llegar a ${safeTarget}`,
        };
    }

    const diffNeeded = Math.max(0, 2 - (maxScore - minScore));
    return {
        canClose: false,
        text: `Falta(n) ${diffNeeded} punto(s) de diferencia para cerrar`,
    };
}
