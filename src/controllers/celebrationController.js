function pickRandom(items, randomFn = Math.random) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const idx = Math.floor(randomFn() * items.length);
    return items[Math.max(0, Math.min(items.length - 1, idx))];
}

export function selectMatchCelebration(
    { winner, loser, isFinal = false, isThirdPlace = false },
    randomFn = Math.random
) {
    const safeWinner = winner || "Jugador";
    const safeLoser = loser || "rival";

    const baseMessages = [
        `${safeWinner} se llevo este partido!`,
        `${safeWinner} estuvo intratable contra ${safeLoser}!`,
        `${safeWinner} suma una victoria clave!`,
        `Punto final para ${safeWinner}. Que partidazo!`,
    ];
    const finalMessages = [
        `${safeWinner} gano la final! Noche historica.`,
        `${safeWinner} es campeon con cierre espectacular!`,
        `${safeWinner} levanta la copa en una final tremenda!`,
    ];
    const thirdPlaceMessages = [
        `${safeWinner} se queda con el tercer puesto!`,
        `${safeWinner} cierra la noche en el podio!`,
    ];

    const messagePool = isFinal
        ? finalMessages
        : isThirdPlace
            ? thirdPlaceMessages
            : baseMessages;

    const confettiOptions = [
        { particleCount: 90, spread: 60, origin: { y: 0.65 } },
        { particleCount: 110, spread: 75, origin: { y: 0.6 } },
        { particleCount: 80, spread: 90, origin: { y: 0.7 } },
    ];
    if (isFinal) {
        confettiOptions.push({ particleCount: 140, spread: 110, origin: { y: 0.58 } });
    }

    return {
        message: pickRandom(messagePool, randomFn) || `${safeWinner} gano su partido!`,
        confetti: pickRandom(confettiOptions, randomFn) || { particleCount: 90, spread: 60, origin: { y: 0.65 } },
    };
}

export function selectChampionCelebration(champion, randomFn = Math.random) {
    const safeChampion = champion || "Campeon";
    const messages = [
        `${safeChampion} se aduena de la noche!`,
        `${safeChampion} levanta la copa con autoridad!`,
        `${safeChampion} cierra el torneo en modo leyenda!`,
        `La mesa tiene dueño: ${safeChampion}!`,
    ];
    const confettiOptions = [
        { particleCount: 180, spread: 120, origin: { y: 0.58 } },
        { particleCount: 220, spread: 100, origin: { y: 0.62 } },
        { particleCount: 200, spread: 130, origin: { y: 0.55 } },
    ];

    return {
        message: pickRandom(messages, randomFn) || `${safeChampion} es campeon!`,
        confetti: pickRandom(confettiOptions, randomFn) || { particleCount: 180, spread: 120, origin: { y: 0.58 } },
    };
}
