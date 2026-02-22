# Plan De Mejoras De Producto

Roadmap de mejoras para uso propio entre amigos.

## Contexto

- Proyecto personal para jugar torneos casuales.
- Prioridad: diversion, rapidez de uso y bajo mantenimiento.
- Evitar sobre-ingenieria y features "enterprise".

## Estado

- Estado global: **ACTIVO**
- Actualizado: **2026-02-22**

## Principios

- Lo que suma diversion primero.
- Cambios chicos, faciles de probar.
- Mantener deploy simple en GitHub Pages.
- No romper reglas base del torneo ni persistencia.

## Fase 1: Flujo Rapido De Juego (Muy Alta Prioridad)

### Alcance

- Crear/entrar a sala con menos pasos y textos mas claros.
- Botones y estados mas obvios en partido en vivo:
  - quien saca
  - quien esta listo
  - cuando se puede cerrar partido
- Confirmaciones cortas en acciones sensibles:
  - sortear
  - resetear

### Criterios de aceptacion

- Un grupo nuevo puede empezar torneo sin explicacion externa.
- Menos errores manuales al operar el marcador.

### Avances recientes

- 2026-02-22: confirmacion visual previa al sorteo (`SORTEAR`) implementada.
- 2026-02-22: estado textual en vivo para indicar cuando un partido se puede cerrar y que falta para finalizar.
- 2026-02-22: resumen final compartible en 1 click (portapapeles) desde anuncio de campeon.
- 2026-02-22: mensajes claros al reclamar identidad ocupada, con tiempo estimado de reintento.

## Fase 2: Features Sociales Y Divertidas (Alta Prioridad)

### Alcance

- Modo "noche de amigos":
  - mini celebraciones al campeon
  - mensajes aleatorios divertidos al terminar partidos
- Personalizacion liviana:
  - nombre de sala
  - color/tema rapido (2 o 3 presets)
- Resumen compartible:
  - copiar resultado final en texto para WhatsApp/Discord.

### Criterios de aceptacion

- Mas interaccion y uso repetido entre torneos.
- Compartir resultados en 1 click.

## Fase 3: Historial Util Para El Grupo (Media Prioridad)

### Alcance

- Historial de ultimos torneos de la sala.
- Ranking simple entre amigos:
  - torneos ganados
  - partidos ganados
  - win rate
- Sin reglas complejas de tie-break al inicio.

### Criterios de aceptacion

- Se puede ver rapidamente "quien viene mejor".
- Datos historicos consistentes tras reconexion/reinicio.

## Fase 4: Calidad De Vida (Media Prioridad)

### Alcance

- Mejoras de reconexion:
  - retomar identidad mas robusto
  - mensajes claros cuando un nombre esta ocupado
- Modo espectador simple para TV/notebook secundaria.
- Atajos de operador para cargar puntos mas rapido.

### Criterios de aceptacion

- Menos friccion en sesiones largas.
- Mejor visibilidad para quienes miran.

## Fase 5: Mantenimiento Minimo (Baja Prioridad)

### Alcance

- Mantener pruebas clave en verde.
- Limpiar deuda tecnica de a poco sin bloquear features.
- Documentacion corta y actualizada.

### Criterios de aceptacion

- Cambios rapidos sin romper lo que ya funciona.
- Menos tiempo de soporte manual.

## Backlog De Ideas (Sin compromiso)

- Tabla de "rivalidad" (head-to-head entre dos jugadores).
- Premio simbolico por medallas semanales.
- Sonidos/animaciones opcionales por perfil.
- Modo "dobles" (si la dinamica del grupo lo pide).

## Fuera De Alcance Por Ahora

- Sistema de cuentas real y roles complejos.
- Moderacion avanzada tipo plataforma publica.
- Telemetria pesada o infraestructura extra.

## Forma De Trabajo Recomendada

1. Elegir 1 mejora chica por semana.
2. Implementar + testear + actualizar README.
3. Probar en una noche real de torneo.
4. Ajustar segun feedback del grupo.
