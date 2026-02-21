export function getFallbackFirebaseConfig() {
    return {
        apiKey: "__API_KEY__",
        authDomain: "__AUTH_DOMAIN__",
        projectId: "__PROJECT_ID__",
        storageBucket: "__STORAGE_BUCKET__",
        messagingSenderId: "__MESSAGING_SENDER_ID__",
        appId: "__APP_ID__",
    };
}

export function resolveFirebaseConfig(injectedConfig, fallbackConfig = getFallbackFirebaseConfig()) {
    try {
        if (injectedConfig) return JSON.parse(injectedConfig);
    } catch (_error) {
        // Ignore parse errors and use fallback placeholders.
    }
    return fallbackConfig;
}

export async function connectFirebase({ firebaseConfig, initFirebaseServices, onStatus }) {
    if (firebaseConfig.apiKey.startsWith("__")) {
        onStatus?.("Falta Config", "text-orange-400");
        return null;
    }
    try {
        const { app, auth, db } = await initFirebaseServices(firebaseConfig);
        const appId = firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("__")
            ? firebaseConfig.projectId
            : "ping-pong-app";
        onStatus?.("Conectado", "text-blue-400");
        return { app, auth, db, dbPathPrefix: `artifacts/${appId}/public/data/tournaments` };
    } catch (_error) {
        onStatus?.("Error", "text-red-500");
        return null;
    }
}
