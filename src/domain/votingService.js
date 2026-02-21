export function buildMatchKey(roomId, roundIdx, matchIdx) {
    return `${roomId}_r${roundIdx}m${matchIdx}`;
}

export function resolveVoteScope(activeSince, createdAt) {
    return activeSince || createdAt || "legacy";
}

export function buildLocalVoteKey(matchKey, voteScope) {
    return `voted_${matchKey}_${voteScope}`;
}

export function canPlayerVoteMatch(match, currentUserIdentity) {
    return !(match?.p1 === currentUserIdentity || match?.p2 === currentUserIdentity);
}

export function buildNextVotes(votes, matchKey, playerNum) {
    const nextVotes = { ...(votes || {}) };
    if (!nextVotes[matchKey]) nextVotes[matchKey] = { p1: 0, p2: 0 };
    if (playerNum === 1) nextVotes[matchKey].p1++;
    else nextVotes[matchKey].p2++;
    return nextVotes;
}
