import { areAllPlayersReady } from "../domain/readyService.js";

export function buildToggleReadyUpdate(currentUserIdentity, readyPlayers) {
    if (!currentUserIdentity) {
        return { ok: false, error: "Primero elige tu identidad" };
    }
    const nextReadyPlayers = { ...(readyPlayers || {}) };
    nextReadyPlayers[currentUserIdentity] = !nextReadyPlayers[currentUserIdentity];
    return { ok: true, nextReadyPlayers };
}

export function buildTournamentMatches(players, randomFn = Math.random) {
    if (!players || players.length < 2) {
        return { ok: false, error: "Se requieren al menos 2 jugadores" };
    }
    const shuffled = [...players].sort(() => randomFn() - 0.5);
    const matches = [];
    while (shuffled.length > 0) {
        const p1 = shuffled.pop();
        const p2 = shuffled.length > 0 ? shuffled.pop() : null;
        matches.push({
            p1,
            p2,
            score1: 0,
            score2: 0,
            winner: p2 ? null : p1,
            isBye: !p2,
            status: "pending",
        });
    }
    return { ok: true, matches };
}

export function validateStartTournament(players, readyPlayers) {
    if (!players || players.length < 2) {
        return { ok: false, error: "Se requieren al menos 2 jugadores" };
    }
    if (!areAllPlayersReady(players, readyPlayers)) {
        return { ok: false, error: "Faltan jugadores por marcarse como listos" };
    }
    return { ok: true };
}
