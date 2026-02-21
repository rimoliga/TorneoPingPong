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
