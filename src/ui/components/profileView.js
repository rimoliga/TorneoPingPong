export function renderBadgeGrid(documentRef, containerId, badges) {
    const cont = documentRef.getElementById(containerId);
    if (!cont) return;
    cont.innerHTML = "";
    (badges || []).forEach((badge) => {
        cont.innerHTML += `<div class="flex flex-col items-center p-2 bg-black/20 rounded border border-white/10 ${badge.unlocked ? "" : "opacity-30 grayscale"}"><div class="text-2xl mb-1 ${badge.unlocked ? "medal-unlocked" : "medal-locked"}">${badge.icon}</div><div class="text-[9px] font-bold text-white leading-tight">${badge.name}</div><div class="text-[8px] text-gray-400 leading-tight mt-1">${badge.desc}</div></div>`;
    });
}

export function renderProfileModalView(documentRef, model) {
    const {
        playerName,
        nickname,
        avatarHtml,
        canEdit,
        perf,
        globalStats,
    } = model;
    documentRef.getElementById("profileName").textContent = playerName;
    documentRef.getElementById("profileNick").textContent = nickname || "";
    documentRef.getElementById("profileAvatarLarge").innerHTML = avatarHtml;
    const editBtn = documentRef.getElementById("editProfileBtn");
    if (canEdit) editBtn.classList.remove("hidden");
    else editBtn.classList.add("hidden");
    documentRef.getElementById("profileDisplay").classList.remove("hidden");
    documentRef.getElementById("profileEdit").classList.add("hidden");
    documentRef.getElementById("statPJ").textContent = perf.played;
    documentRef.getElementById("statPG").textContent = perf.won;
    documentRef.getElementById("statWinRate").textContent = `${perf.winRate}%`;
    documentRef.getElementById("gStatPJ").textContent = globalStats.played;
    documentRef.getElementById("gStatWins").textContent = globalStats.won;
    documentRef.getElementById("gStatChamp").textContent = globalStats.tourneys;
    documentRef.getElementById("profileModal").classList.remove("hidden");
}
