<!-- --------- Comentario personal  a publicacion .Random() --------- -->

Este proyecto me enseñó que "legacy" no es sinónimo de "malo."

El PHP sin framework de Calavera tenía 7 años de lógica de negocio embebida. 

Reescribir = reproducir 7 años de learnings en 6 meses. Imposible capturar toda la lógica y altísimo riesgo de romper flujos críticos.

La alternativa: coexistencia.

Lo más complejo no fue el microservice FastAPI, fue diseñar el deployment para que ambos sistemas evolucionen independientemente. Blue-green con health checks automáticos. Si algo falla, rollback en segundos.

Ahora tienen legacy estable + microservice moderno agregando capacidades nuevas, deployando independientemente.

El approach "add, don't replace" a veces es más inteligente que "rewrite from scratch."

Especialmente cuando el legacy contiene 7 años de conocimiento que no está en ningún documento.

¿Alguien más tiene legacy que no pueden reescribir?