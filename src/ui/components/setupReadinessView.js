import { areAllPlayersReady, countReadyPlayers, normalizeReadyPlayers } from "../../domain/readyService.js";

export function renderSetupReadiness({
    players,
    readyPlayers,
    currentUserIdentity,
    playerCountEl,
    readyCountEl,
    readyBtnEl,
    startBtnEl,
}) {
    const normalized = normalizeReadyPlayers(players, readyPlayers);
    const readyCount = countReadyPlayers(players, normalized);
    const allReady = areAllPlayersReady(players, normalized);

    if (playerCountEl) playerCountEl.textContent = `${players.length} Jugadores`;
    if (readyCountEl) readyCountEl.textContent = `${readyCount}/${players.length} listos`;
    if (readyBtnEl) readyBtnEl.textContent = currentUserIdentity && normalized[currentUserIdentity] ? "NO LISTO" : "LISTO";
    if (startBtnEl) startBtnEl.disabled = !allReady;
}
