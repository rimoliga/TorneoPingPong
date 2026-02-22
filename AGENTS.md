# AGENT.md

Contexto operativo para asistentes/agentes que trabajen en este repo.

## Proyecto

- Nombre: `TorneoPingPong`
- Stack:
  - Frontend vanilla: `index.html` + `script.js`
  - Backend local: `server.js` (Node HTTP + dotenv)
  - Persistencia: Firebase Firestore + Auth anonimo
  - Tests: `node:test` (`npm test`)

## Objetivo funcional

Aplicacion de torneos de ping pong en tiempo real con:

- Salas por codigo
- Identidad por jugador (claims)
- Estado `LISTO` por jugador
- Sorteo solo cuando todos estan listos
- Bracket + marcador en vivo
- Votacion por partido (1 voto por partido por torneo)
- Estadisticas y reinicio de torneo

## Archivos clave

- `index.html`: estructura UI completa
- `script.js`: entrypoint/orquestacion (evitar sumar logica nueva inline)
- `server.js`: servidor local e inyeccion de variables Firebase en HTML
- `tests/*.test.js`: pruebas integradas y de contrato
- `.github/workflows/deploy.yml`: deploy GitHub Pages
- `docs/RESTRUCTURE_PLAN.md`: plan tecnico de reestructuracion (completado)
- `docs/PRODUCT_IMPROVEMENT_PLAN.md`: roadmap activo de producto

## Estado tecnico actual

- Reestructuracion modular completada.
- Estructura vigente:
  - `src/domain`: reglas puras
  - `src/services`: acceso a Firebase
  - `src/controllers`: logica de flujo y calculos
  - `src/ui/components`: render por secciones
  - `src/app`: bootstrap
- Nuevas funcionalidades deben agregarse en modulos, no en logica inline dentro de `script.js`.

## Comandos utiles

- Instalar deps: `npm install`
- Levantar local: `npm start`
- Ejecutar tests: `npm test`

### Nota de entorno (Windows PATH parcial)

Si `npm`/`node` fallan por PATH, ejecutar desde `cmd` inyectando ruta de instalacion:

- `cmd /c "set PATH=C:\Program Files\nodejs;%PATH%&& npm test"`
- `cmd /c "set PATH=C:\Program Files\nodejs;%PATH%&& npm start"`

Alternativa directa:

- `C:\Program Files\nodejs\node.exe --test`

## Datos de sala en Firestore (campos relevantes)

- `players`, `playerMeta`
- `claims`, `claimsMeta`
- `readyPlayers`
- `rounds`, `votes`
- `active`, `activeSince`, `champion`
- `creator`, `creatorName`
- `globalStats`

## Reglas importantes al modificar

1. Mantener consistencia de IDs:
   - Si cambias `id` en `index.html`, ajustar referencias en `script.js`.
2. No romper reglas de negocio:
   - `startTournament` requiere todos listos.
   - El score/finalizacion debe respetar target y diferencia de 2.
3. Reconexion:
   - Respetar claims con `claimsMeta` (stale/heartbeat).
4. Evitar regresiones:
   - Correr `npm test` despues de cambios.
5. Encoding:
   - Mantener `script.js` en UTF-8 sin BOM.
6. Documentacion:
   - Si se cambia comportamiento, flujo, datos, setup o comandos, actualizar `README.md` en el mismo cambio.
7. Roadmap de producto:
   - Si una mejora entra en alcance funcional, actualizar `docs/PRODUCT_IMPROVEMENT_PLAN.md`.

## Checklist antes de cerrar tarea

- [ ] Codigo compila/corre local
- [ ] Tests en verde (`npm test`)
- [ ] No hay conflicto entre UI y logica (IDs/handlers)
- [ ] `README.md` actualizado si cambio comportamiento/arquitectura/setup
