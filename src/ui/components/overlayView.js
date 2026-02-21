const VAR_RESULTS = ["PUNTO VALIDO", "MALA MIA", "SE REPITE", "COMPRADO", "FUE AFUERA", "TODO LEGAL"];

export function showNotificationOverlayView(documentRef, navigatorRef, playSoundFn) {
    documentRef.getElementById("notificationOverlay").classList.remove("hidden");
    if (navigatorRef?.vibrate) navigatorRef.vibrate([200, 100, 200]);
    playSoundFn("notify", 0.5);
}

export function playVarAnimationView(documentRef, playSoundFn, setTimeoutFn, randomFn = Math.random) {
    const overlay = documentRef.getElementById("varOverlay");
    const text = documentRef.getElementById("varStatusText");
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    text.textContent = "ANALIZANDO JUGADA...";
    playSoundFn("var");
    setTimeoutFn(() => {
        text.textContent = VAR_RESULTS[Math.floor(randomFn() * VAR_RESULTS.length)];
    }, 2000);
    setTimeoutFn(() => {
        overlay.classList.add("hidden");
        overlay.classList.remove("flex");
    }, 4500);
}
