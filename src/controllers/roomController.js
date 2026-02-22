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

export function buildStartTournamentConfirmation(players, targetScore) {
    const list = Array.isArray(players) ? players.filter((name) => typeof name === "string" && name.trim().length > 0) : [];
    const safeTarget = Number.isFinite(Number(targetScore)) && Number(targetScore) > 0 ? Math.floor(Number(targetScore)) : 11;
    const preview = list.length > 0 ? list.slice(0, 8).join(", ") : "sin jugadores";
    const extra = list.length > 8 ? `, +${list.length - 8} mas` : "";
    return `Se sortearan ${list.length} jugadores a ${safeTarget} puntos. Jugadores: ${preview}${extra}.`;
}

export function buildTournamentNameUpdate({ isCreator, currentName, nextName }) {
    if (!isCreator) {
        return { ok: false, error: "Solo el creador puede cambiar el nombre del torneo" };
    }
    const normalized = typeof nextName === "string" ? nextName.trim() : "";
    if (!normalized) {
        return { ok: false, error: "El nombre del torneo no puede estar vacio" };
    }
    if (normalized.length > 25) {
        return { ok: false, error: "Maximo 25 caracteres para el nombre del torneo" };
    }
    const previous = typeof currentName === "string" ? currentName.trim() : "";
    if (normalized === previous) {
        return { ok: false, error: "El nombre ya es el actual" };
    }
    return { ok: true, tournamentName: normalized };
}
