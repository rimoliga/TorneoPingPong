export function normalizeReadyPlayers(players, readyPlayers) {
    const source = readyPlayers || {};
    const normalized = {};
    (players || []).forEach((player) => {
        normalized[player] = !!source[player];
    });
    return normalized;
}

export function countReadyPlayers(players, readyPlayers) {
    const normalized = normalizeReadyPlayers(players, readyPlayers);
    return (players || []).filter((player) => !!normalized[player]).length;
}

export function areAllPlayersReady(players, readyPlayers) {
    const list = players || [];
    if (list.length < 2) return false;
    const normalized = normalizeReadyPlayers(list, readyPlayers);
    return list.every((player) => !!normalized[player]);
}
