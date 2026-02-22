# Plan De Reestructuracion

Plan incremental para separar responsabilidades en el frontend y mantener deploy estable en GitHub Pages.

## Objetivos

- Reducir acoplamiento entre UI, reglas de negocio y acceso a datos.
- Evitar regresiones durante migracion.
- Mantener compatibilidad con GitHub Pages en todo momento.

## Estado actual

- App principalmente monolitica en `script.js`.
- Deploy en GitHub Pages funcionando.
- Tests existentes de servidor, contrato DOM y reglas criticas.

## Estado general del plan

- Estado global: **COMPLETADO**.
- Fecha de cierre: **2026-02-21**.
- Progreso actual:
  - Ajuste de deploy: **completado**
  - Fase 1 (dominio y tests): **completado**
  - Fase 2 (servicios/repositorio): **completado**
  - Fase 3 (UI/controladores): **completado**
  - Fase 4 (bootstrap final): **completado**

## Ajuste de deploy aplicado (completado)

- Workflow `.github/workflows/deploy.yml` actualizado con:
  - Job `test` previo al deploy (`npm ci` + `npm test`).
  - Job `deploy` dependiente de `test`.
  - Inyeccion de placeholders Firebase preparada para:
    - `index.html` (estructura actual)
    - `src/config/firebase-config.js` (estructura modular futura)
    - `src/config/firebase-config.template.js` (opcional futura)
  - Escape seguro de valores para `sed`.

## Arquitectura objetivo

```txt
src/
  app/
  core/
  services/
  domain/
  ui/
  controllers/
  utils/
```

## Fases de migracion

### Fase 1: Dominio puro y tests

- Extraer reglas a modulos puros:
  - `scoringService`
  - `readyService`
  - `identityService`
  - `votingService`
- Aumentar tests unitarios sobre dominio.

Estado: completado

- Hecho:
  - `src/domain/scoringService.js`
  - `src/domain/readyService.js`
  - `src/domain/identityService.js`
  - `src/domain/votingService.js`
  - Integracion de ambos en `script.js`
  - `tests/domain-services.test.js` ampliado para los 4 servicios de dominio

### Fase 2: Servicios y repositorio

- Encapsular Firebase/Auth en `services/firebase`.
- Crear `roomRepository` para lecturas/escrituras.
- Reducir acceso directo a `updateDoc` desde UI.

Estado: completado

- Hecho:
  - `src/services/firebase/firebaseClient.js`
  - `src/services/firebase/roomRepository.js`
  - `script.js` usa `initFirebaseServices`, `createRoom`, `patchRoom`, `subscribeRoom`
  - acoplamientos de UI/flujo reducidos mediante delegacion a modulos de Fase 3

### Fase 3: UI y controladores

- Dividir render en componentes:
  - player list
  - bracket
  - live match
  - profile
- Crear controladores de lobby/sala.

Estado: completado

- Hecho:
  - `src/controllers/roomController.js` (validacion de inicio, toggle ready, armado de cruces)
  - `src/controllers/matchController.js` (progresion de rondas, final/3er puesto y campeon)
  - `src/controllers/statsController.js` (calculo y orden de tabla de posiciones)
  - `src/controllers/notificationController.js` (turnos pendientes y nuevos ganadores)
  - `src/controllers/profileController.js` (metricas por jugador y medallas)
  - `src/ui/components/setupReadinessView.js` (render de contadores readiness y estado de botones)
  - `src/ui/components/bracketView.js` (render de rondas y tarjetas del bracket)
  - `src/ui/components/liveMatchView.js` (render de header y estado del modal en vivo)
  - `src/ui/components/featuredMatchView.js` (seleccion y render de partido destacado)
  - `src/ui/components/overlayView.js` (notificacion + animacion VAR)
  - `src/ui/components/layoutView.js` (sincronizacion de secciones y modal de campeon/live)
  - `src/ui/components/profileView.js` (render de perfil y badges)
  - `script.js` integrado con esos modulos para:
    - `window.toggleReady`
    - `window.startTournament`
    - `window.finishMatch` (delegacion de progresion)
    - `calculateAndRenderStats` (delegacion de calculo)
    - `renderBracket` (delegacion de UI)
    - `openLiveMatch` y `updateLiveMatchUI` (delegacion de UI)
    - `renderFeaturedMatch` (delegacion de UI)
    - `checkMyTurn`, `checkForNewWinners`, `showNotificationOverlay`, `playVarAnimation` (delegacion de logica/UI)
    - `syncUI` (delegacion de layout principal)
    - `showProfileModal`, `getPlayerBadges` (delegacion de perfil/medallas)
    - `renderPlayerList` (estado readiness)

### Fase 4: Bootstrap final

- Dejar `script.js` como entrypoint temporal minimo.
- Mover inicio a `src/app/bootstrap.js`.
- Mantener handlers necesarios para `onclick` hasta migrar a listeners.

Estado: completado

- Hecho:
  - `src/app/bootstrap.js` con:
    - `getFallbackFirebaseConfig`
    - `resolveFirebaseConfig`
    - `connectFirebase`
  - `script.js` integrado para delegar resolucion de config + conexion Firebase en bootstrap
  - `script.js` consolidado como capa de orquestacion con logica delegada a modulos
  - migracion de handlers inline `onclick` evaluada: se mantienen por compatibilidad con HTML actual y contrato DOM, con reduccion de riesgo por cobertura automatizada

## Criterios de aceptacion por fase

- Tests verdes.
- No regresion funcional visible.
- README actualizado con cambios relevantes.
- Deploy en Pages validado tras merge.

## Riesgos y mitigaciones

- Riesgo: ruptura de handlers inline `onclick`.
  - Mitigacion: migracion gradual + contrato DOM.
- Riesgo: desalineacion de placeholders Firebase.
  - Mitigacion: workflow ya preparado para multiples archivos.
- Riesgo: regresion en reglas de torneo.
  - Mitigacion: ampliar tests de dominio antes de mover UI.

## Cierre

- Plan finalizado end-to-end.
- Entregables completados:
  - modularizacion de dominio, servicios, controladores y vistas
  - bootstrap desacoplado
  - cobertura de tests extendida y estable
- El siguiente ciclo de trabajo queda en:
  - `docs/PRODUCT_IMPROVEMENT_PLAN.md`
