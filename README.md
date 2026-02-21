# TorneoPingPong

Aplicación web para organizar torneos de ping pong en tiempo real, con salas compartidas, identidad por jugador, llaves de eliminación, marcador en vivo, votación del público y estadísticas acumuladas.

## 1. Qué hace (visión funcional)

La app permite:

- Crear una sala de torneo y compartir un código corto.
- Unirse a una sala existente con el código.
- Reclamar identidad de jugador dentro de la sala.
- Cargar jugadores y apodos.
- Marcarse como `LISTO` antes del sorteo.
- Iniciar torneo solo cuando todos los jugadores estén listos.
- Gestionar partidos en vivo (sumar/restar puntos, finalizar match, notificaciones).
- Ejecutar revisión tipo VAR (overlay visual).
- Votar por ganador de partidos (1 voto por partido y por torneo).
- Ver tabla de posiciones y métricas por jugador.
- Reiniciar torneo guardando estadísticas históricas.

## 2. Flujo principal de uso

1. Creador abre la app y crea sala (nombre, torneo, puntos objetivo).
2. Jugadores se unen con código de sala.
3. Cada jugador selecciona o registra su identidad.
4. Todos marcan `LISTO`.
5. Se habilita `SORTEAR` cuando `todos listos = true`.
6. Se juegan partidos desde la vista de bracket / árbitro.
7. Al terminar, se anuncia campeón.
8. Se puede reiniciar torneo archivando estadísticas globales.

## 3. Roles y permisos

- `Creador/Admin`:
  - Ve controles administrativos (`reset`, `llamar a jugar`, remover jugadores).
  - Se identifica de forma robusta por:
    - `creator` (uid auth), o
    - `creatorName` (nombre del creador en sala), para tolerar reconexiones.
- `Jugador`:
  - Puede marcarse listo/no listo.
  - Puede votar partidos en los que no participa.

## 4. Reconexión e identidad

La sala usa `claims` para reservar nombres. Para evitar bloqueos por desconexión:

- Hay heartbeat de claim (`claimsMeta.updatedAt`) cada 30s.
- Si un claim queda stale (sin actualización por más de 2 minutos), puede recuperarse.
- Si un usuario vuelve con identidad guardada en `localStorage`, la app intenta re-claim automático.

## 5. Requisitos técnicos

- Node.js 18+ (recomendado LTS)
- npm
- Proyecto Firebase configurado (Auth Anónimo + Firestore)

## 6. Stack técnico

- Frontend: `index.html` + `script.js` (sin framework)
- Styling: Tailwind vía CDN
- Backend local: `server.js` con Node HTTP + `dotenv`
- Persistencia: Firestore (tiempo real con `onSnapshot`)
- Auth: Firebase Anonymous Auth
- Testing: `node:test` (runner nativo de Node)

## 7. Estructura del proyecto

- `index.html`: UI principal.
- `script.js`: lógica funcional completa del torneo.
- `src/domain/readyService.js`: reglas puras del estado de jugadores listos.
- `src/domain/scoringService.js`: reglas puras de score, victoria y ganador.
- `src/domain/identityService.js`: reglas puras de claims/reconexión de identidad.
- `src/domain/votingService.js`: reglas puras de claves/scope y acumulación de votos.
- `src/services/firebase/firebaseClient.js`: inicialización de Firebase/Auth/Firestore.
- `src/services/firebase/roomRepository.js`: repositorio de sala (create/patch/subscribe).
- `src/controllers/roomController.js`: reglas de flujo de sala (toggle ready, validación de sorteo, armado de cruces).
- `src/controllers/matchController.js`: progresión de rondas, final/3er puesto y cálculo de campeón.
- `src/controllers/statsController.js`: cálculo y ordenamiento de la tabla de posiciones.
- `src/controllers/notificationController.js`: detección de notificaciones de turno y nuevos ganadores.
- `src/controllers/profileController.js`: cálculo de métricas por jugador y sets de medallas.
- `src/app/bootstrap.js`: resolución de configuración Firebase y conexión inicial de app/auth/db.
- `src/ui/components/setupReadinessView.js`: render de estado de readiness en setup.
- `src/ui/components/bracketView.js`: render del bracket por rondas y tarjetas de partidos.
- `src/ui/components/liveMatchView.js`: render del modal de partido en vivo (header, votos, saque y estado de cierre).
- `src/ui/components/featuredMatchView.js`: selección y render de la tarjeta de partido destacado.
- `src/ui/components/overlayView.js`: render de overlays de notificación y animación VAR.
- `src/ui/components/layoutView.js`: sincronización de secciones principales, modal live y anuncio de campeón.
- `src/ui/components/profileView.js`: render del modal de perfil y grillas de medallas.
- `server.js`: servidor local e inyección de variables Firebase en runtime.
- `tests/`: pruebas de integración/contrato/frontend.
- `.github/workflows/deploy.yml`: despliegue a GitHub Pages con secrets.

## 8. Variables de entorno

El servidor local reemplaza placeholders Firebase en `index.html` usando `.env`.

Variables requeridas:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

## 9. Ejecución local

1. Instalar dependencias:

```bash
npm install
```

2. Configurar `.env` con credenciales Firebase.

3. Levantar servidor:

```bash
npm start
```

4. Abrir:

- `http://localhost:3000`

## 10. Pruebas

Ejecutar:

```bash
npm test
```

La suite actual cubre:

- Servidor:
  - Inyección de placeholders en `/`
  - Entrega de assets
  - 404 de archivo inexistente
  - Bloqueo de path traversal
- Contrato DOM:
  - IDs usados por `script.js` existen en `index.html`
- Frontend:
  - Reglas de score y finalización de partido
  - Restricción de inicio por `todos listos`
  - Voto por partido por torneo
- Dominio puro:
  - Normalización y conteo de `readyPlayers`
  - Reglas de victoria/finalización de match
  - Reglas de claims (stale, reuso de identidad, claim patch)
  - Reglas de votación (scope por torneo, key local y acumulación)
  - Controlador de sala (ready/start tournament) y render de readiness setup
  - Controlador de partidos (progresión de rondas y campeón)
  - Controlador de estadísticas (tabla de posiciones)
  - Controlador de notificaciones (turnos y detección de ganadores nuevos)
  - Controlador de perfil (métricas + medallas)
  - Componente de UI para bracket (rondas y acciones de partido)
  - Componente de UI para live match (marcador/votos/saque/finalización)
  - Componente de UI para featured match (tarjeta destacada + acción de arbitraje/voto)
  - Componente de UI para overlays de notificación/VAR
  - Componente de UI para sincronización de layout general (setup/bracket/live/champion)
  - Componente de UI para perfil (modal y badges)
  - Bootstrap de app desacoplado para configuración y conexión Firebase
- Servicios:
  - Cliente Firebase desacoplado de `script.js`
  - Repositorio de sala para escrituras/suscripción

## 11. Modelo de datos (Firestore)

Documento de sala (colección base: `artifacts/{appId}/public/data/tournaments/{roomCode}`):

- `tournamentName: string`
- `targetScore: number`
- `players: string[]`
- `playerMeta: { [playerName]: { nickname?: string } }`
- `claims: { [playerName]: clientUUID }`
- `claimsMeta: { [playerName]: { clientUUID: string, updatedAt: number } }`
- `readyPlayers: { [playerName]: boolean }`
- `rounds: Round[]`
- `votes: { [matchKey]: { p1: number, p2: number } }`
- `varTrigger: number`
- `active: boolean`
- `activeSince: number | null`
- `champion: string | null`
- `globalStats: { [playerName]: { played: number, won: number, tourneys: number } }`
- `creator: string` (uid)
- `creatorName: string | null`
- `createdAt: ISO string`

## 12. Deploy (GitHub Pages)

El workflow:

- Reemplaza placeholders Firebase en `index.html` usando GitHub Secrets.
- Publica el contenido en GitHub Pages.

Secrets requeridos en el repo:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

Notas de pipeline:

- El workflow ejecuta tests (`npm test`) antes de deploy.
- La inyeccion de placeholders Firebase soporta:
  - `index.html` (estructura actual)
  - `src/config/firebase-config.js` y `src/config/firebase-config.template.js` (estructura modular futura)
- Archivo: `.github/workflows/deploy.yml`

## 13. Plan de reestructuracion

Plan tecnico incremental documentado en:

- `docs/RESTRUCTURE_PLAN.md`

## 14. Troubleshooting rápido

- `No conecta / Falta Config`:
  - Revisar `.env` o secrets de GitHub.
- `No puedo reclamar nombre`:
  - Esperar expiración de claim stale o volver a entrar con identidad guardada.
- `No se habilita SORTEAR`:
  - Confirmar que todos los jugadores estén en estado `LISTO`.
- `No veo botones de reset`:
  - Verificar que la identidad actual coincida con creador (`creatorName`) o sea admin válido.

## 15. Notas de mantenimiento

- Si cambias IDs en HTML, ejecuta tests de contrato DOM para evitar errores runtime.
- Mantener `script.js` en UTF-8 sin BOM para evitar fallos en tests de frontend.
- No exponer credenciales en repos públicos; usar `.env` local y secrets en CI/CD.
