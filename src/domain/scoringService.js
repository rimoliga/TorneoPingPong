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
