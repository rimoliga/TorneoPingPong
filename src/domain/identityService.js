export function isClaimStaleForPlayer(name, claims, claimsMeta, clientUUID, staleMs, now = Date.now()) {
    const owner = claims?.[name];
    if (!owner || owner === clientUUID) return false;
    const ts = claimsMeta?.[name]?.updatedAt || 0;
    if (!ts) return false;
    return (now - ts) > staleMs;
}

export function canUseStoredIdentity(storedName, players, claims, claimsMeta, clientUUID, staleMs, now = Date.now()) {
    if (!storedName) return false;
    if (!(players || []).includes(storedName)) return false;
    const owner = claims?.[storedName];
    if (!owner || owner === clientUUID) return true;
    return isClaimStaleForPlayer(storedName, claims, claimsMeta, clientUUID, staleMs, now);
}

export function buildClaimPatch(name, clientUUID, includeReadyFlag = false, now = Date.now()) {
    const patch = {};
    patch[`claims.${name}`] = clientUUID;
    patch[`claimsMeta.${name}`] = { clientUUID, updatedAt: now };
    if (includeReadyFlag) patch[`readyPlayers.${name}`] = false;
    return patch;
}

export function evaluateClaimStatus(name, players, claims, claimsMeta, clientUUID, staleMs, now = Date.now()) {
    if (!name || typeof name !== "string") {
        return { ok: false, reason: "invalid_name" };
    }
    if (Array.isArray(players) && !players.includes(name)) {
        return { ok: false, reason: "not_found" };
    }

    const owner = claims?.[name];
    if (!owner || owner === clientUUID) {
        return { ok: true, reason: "available" };
    }

    const ts = claimsMeta?.[name]?.updatedAt || 0;
    const isStale = ts > 0 && (now - ts) > staleMs;
    if (isStale) {
        return { ok: true, reason: "stale_recoverable" };
    }

    const retryInMs = ts > 0 ? Math.max(0, staleMs - (now - ts)) : staleMs;
    return { ok: false, reason: "occupied", retryInMs };
}

export function getClaimBlockedMessage(status) {
    if (!status || status.ok) return "";
    if (status.reason === "not_found") return "Ese nombre no existe en esta sala";
    if (status.reason === "invalid_name") return "Nombre invalido";
    if (status.reason !== "occupied") return "No se puede reclamar ese nombre ahora";

    const retryInMs = Number(status.retryInMs || 0);
    const retryInSec = Math.ceil(retryInMs / 1000);
    if (retryInSec <= 0) return "Nombre ocupado en este momento";
    if (retryInSec < 60) return `Nombre ocupado. Reintenta en ~${retryInSec}s o usa otro nombre.`;

    const retryInMin = Math.ceil(retryInSec / 60);
    return `Nombre ocupado. Reintenta en ~${retryInMin} min o usa otro nombre.`;
}
