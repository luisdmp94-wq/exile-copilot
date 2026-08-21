# Hito 6C — Probar y volver

## Objetivo

Cerrar el bucle principal de Exile Copilot: recibir una acción, probarla dentro
de Path of Exile 2, volver y registrar el resultado sin convertir la aplicación
en un formulario técnico ni en un chatbot genérico.

## Flujo visible

1. La recomendación muestra **qué hacer** y **qué observar**.
2. **Probar y volver** abre una prueba en curso con una sola acción activa.
3. **Volví de jugar** ofrece cinco resultados rápidos:
   - Problema resuelto.
   - Mejoró, pero continúa.
   - Sigue igual.
   - Empeoró.
   - Ocurrió algo diferente.
4. El jugador puede añadir un comentario y declarar que se trata de una
   sensación. La interfaz la conserva como experiencia, no como dato medido.
5. Un resultado resuelto cierra el caso. Los demás conservan la continuidad y
   permiten que el mentor mantenga o cambie la próxima acción.

## Contrato y compatibilidad

- `DecisionOutcome` añade un resultado estructurado sin romper datos previos.
- `lastResult.outcome` acepta `null`; una sesión antigua sigue cargando.
- La conclusión es determinista: `resolved` completa, un hallazgo valioso
  inesperado cambia la estrategia y los demás resultados continúan.
- La observación se deriva del impacto esperado de la recomendación. No se
  inventan métricas ni se promete detectar automáticamente lo ocurrido en el
  juego.

## Simplificación de la interfaz

- Evidencia, restricciones y reapertura siguen disponibles, pero se agrupan
  como opciones avanzadas.
- El informe de exportación permanece accesible y plegado por defecto.
- Los textos principales evitan jerga interna y priorizan la siguiente acción.

## Límites honestos

- El jugador todavía debe actualizar el expediente si sus datos cambiaron.
- Una sensación no prueba una mejora estadística.
- La aplicación no observa el juego ni sincroniza automáticamente con GGG.
- Este hito no añade economía, crafting ni reglas nuevas de PoE2.
