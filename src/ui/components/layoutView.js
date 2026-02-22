export function renderSetupOrBracketView(documentRef, { active, isCreator, currentUserIdentity }, handlers) {
    if (active) {
        documentRef.getElementById("setupSection").classList.add("hidden");
        documentRef.getElementById("bracketSection").classList.remove("hidden");
        handlers.renderFeaturedMatch();
        handlers.renderBracket();
        return;
    }
    documentRef.getElementById("bracketSection").classList.add("hidden");
    if (!currentUserIdentity || isCreator) {
        documentRef.getElementById("setupSection").classList.remove("hidden");
        handlers.renderPlayerList();
        return;
    }
    documentRef.getElementById("setupSection").classList.remove("hidden");
    handlers.renderPlayerList();
}

export function syncLiveMatchModal(documentRef, rounds, liveMatchIndices, handlers) {
    if (documentRef.getElementById("liveMatchModal").classList.contains("hidden") || !liveMatchIndices) return;
    const round = rounds?.[liveMatchIndices.rIdx];
    if (round && round.matches?.[liveMatchIndices.mIdx]) {
        handlers.updateLiveMatchUI(round.matches[liveMatchIndices.mIdx]);
    } else {
        handlers.closeLiveMatch();
    }
}

export function syncChampionAnnouncement(documentRef, state, handlers) {
    const modal = documentRef.getElementById("winnerAnnouncement");
    const btn = documentRef.getElementById("showChampionBtn");
    if (state.champion) {
        btn.classList.remove("hidden");
        if (!state.winnerAcknowledged && modal.classList.contains("hidden")) {
            modal.classList.remove("hidden");
            documentRef.getElementById("winnerText").textContent = state.champion;
            const championCelebration = typeof handlers.getChampionCelebration === "function"
                ? handlers.getChampionCelebration(state.champion)
                : { message: `${state.champion} es campeon!`, confetti: { particleCount: 150, spread: 100 } };
            const subtitle = documentRef.getElementById("winnerSubtext");
            if (subtitle) subtitle.textContent = championCelebration.message;
            documentRef.getElementById("winnerAvatarLarge").innerHTML = handlers.getAvatar(state.champion, 80);
            handlers.confetti(championCelebration.confetti);
            handlers.playSound("win", 0.3);
        }
        return state.winnerAcknowledged;
    }
    btn.classList.add("hidden");
    modal.classList.add("hidden");
    return false;
}
