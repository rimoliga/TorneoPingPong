export function renderLiveMatchHeader({ documentRef, match, getAvatar, playerMeta }) {
    if (!documentRef || !match) return;
    documentRef.getElementById("liveP1Name").textContent = match.p1;
    documentRef.getElementById("liveP1Avatar").innerHTML = getAvatar(match.p1, 64);
    documentRef.getElementById("liveP1Nick").textContent = playerMeta?.[match.p1]?.nickname || "";
    documentRef.getElementById("liveP2Name").textContent = match.p2;
    documentRef.getElementById("liveP2Avatar").innerHTML = getAvatar(match.p2, 64);
    documentRef.getElementById("liveP2Nick").textContent = playerMeta?.[match.p2]?.nickname || "";
}

export function renderLiveMatchState({
    documentRef,
    match,
    liveMatchIndices,
    currentRoomId,
    votesByMatch,
    currentUserIdentity,
    targetScore,
    isWinningState,
}) {
    if (!documentRef || !match || !liveMatchIndices) return { shouldCelebrate: false };
    documentRef.getElementById("liveP1Score").textContent = match.score1;
    documentRef.getElementById("liveP2Score").textContent = match.score2;

    const matchKey = `${currentRoomId}_r${liveMatchIndices.rIdx}m${liveMatchIndices.mIdx}`;
    const votes = votesByMatch?.[matchKey] || { p1: 0, p2: 0 };
    const totalVotes = votes.p1 + votes.p2;
    const p1Pct = totalVotes === 0 ? 50 : (votes.p1 / totalVotes) * 100;
    const p2Pct = totalVotes === 0 ? 50 : (votes.p2 / totalVotes) * 100;
    documentRef.getElementById("barVoteP1").style.width = `${p1Pct}%`;
    documentRef.getElementById("textVoteP1").textContent = totalVotes === 0 ? "50%" : `${Math.round(p1Pct)}%`;
    documentRef.getElementById("textVoteP2").textContent = totalVotes === 0 ? "50%" : `${Math.round(p2Pct)}%`;

    const amIPlaying = match.p1 === currentUserIdentity || match.p2 === currentUserIdentity;
    if (amIPlaying) {
        documentRef.getElementById("voteBtnP1").classList.add("hidden");
        documentRef.getElementById("voteBtnP2").classList.add("hidden");
    } else {
        documentRef.getElementById("voteBtnP1").classList.remove("hidden");
        documentRef.getElementById("voteBtnP2").classList.remove("hidden");
    }

    const isWin = isWinningState(match.score1, match.score2, targetScore);
    const p1Area = documentRef.getElementById("liveAreaP1");
    const p2Area = documentRef.getElementById("liveAreaP2");
    if (isWin) {
        p1Area.classList.add("locked-add");
        p2Area.classList.add("locked-add");
    } else {
        p1Area.classList.remove("locked-add");
        p2Area.classList.remove("locked-add");
    }

    const finishBtn = documentRef.getElementById("liveFinishBtnContainer");
    const shouldCelebrate = isWin && !match.winner;
    if (shouldCelebrate) finishBtn.classList.remove("hidden");
    else finishBtn.classList.add("hidden");

    const totalPoints = match.score1 + match.score2;
    const maxScore = Math.max(match.score1, match.score2);
    let serverP1 = true;
    if (maxScore >= (targetScore - 1) && match.score1 >= (targetScore - 1) && match.score2 >= (targetScore - 1)) {
        serverP1 = (totalPoints % 2) === 0;
    } else {
        const changeRate = targetScore >= 21 ? 5 : 2;
        serverP1 = Math.floor(totalPoints / changeRate) % 2 === 0;
    }
    if (serverP1) {
        documentRef.getElementById("liveP1Serve").classList.remove("hidden");
        documentRef.getElementById("liveP2Serve").classList.add("hidden");
    } else {
        documentRef.getElementById("liveP1Serve").classList.add("hidden");
        documentRef.getElementById("liveP2Serve").classList.remove("hidden");
    }

    return { shouldCelebrate };
}
