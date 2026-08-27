# Roadmap de Exile Copilot

> Estado consolidado: 26 de agosto de 2026. Objetivo público: estar preparado
> para Path of Exile 2 1.0 sin heredar datos ni mecánicas del parche anterior.

## 1. Base ya construida

- [x] Expediente de personaje, paperdoll y separación entre personaje actual y
  plan `.build` oficial de GGG.
- [x] Diario persistente, una única acción activa y sesiones de decisión con
  resultado, pausa, reapertura y reconciliación.
- [x] Mentor v3: conversación asistida por Groq, validada contra el motor y con
  respaldo determinista cuando la IA falla o intenta salir del contexto.
- [x] Mascota v2: estados visuales, avisos ante cambios semánticos y acceso a la
  explicación sin llamadas automáticas al proveedor de IA.
- [x] Academia de Crafting básica, media y avanzada; ayuda en vivo y taller
  avanzado con contrato, parada, antes/después y recuperación.
- [x] Barreras de compatibilidad por parche, procedencia visible y publicación
  bloqueada cuando faltan evidencias.
- [x] Prueba local de música mediante YouTube, solo en desarrollo y activada por
  el jugador. No es todavía una capacidad de producción.

## 2. Trabajo prioritario antes de PoE2 1.0

- [ ] Probar Crafting junto al juego con recorridos reales de jugador nuevo y
  experto; registrar cada bloqueo, texto confuso y resultado que el importador
  no comprenda.
- [ ] Ampliar la evidencia de Crafting sin inventar pools, pesos ni
  probabilidades: bases, afijos observados, monedas, Essences y Alloys.
- [ ] Conseguir que la ayuda en vivo parta del personaje, objetivo, pieza y
  presupuesto cuando existan, y que declare claramente qué falta cuando no
  puede juzgar el encaje.
- [ ] Terminar de pulir densidad, navegación, estados interactivos, responsive y
  accesibilidad pantalla por pantalla.
- [ ] Decidir el alcance público de música, proveedores externos y costes antes
  de convertir cualquier prototipo local en producto.
- [ ] Preparar despliegue, secretos, límites de uso, privacidad, recuperación y
  monitorización de errores para usuarios reales.

## 3. Activación específica de PoE2 1.0

La fecha anunciada no autoriza reutilizar datos de `0.5.4f`. Al publicarse 1.0:

1. Registrar el parche y su fuente oficial.
2. Capturar y probar tooltips reales de objetos en los idiomas soportados.
3. Volver a verificar monedas básicas, Essences, Alloys y sus transiciones.
4. Actualizar pasivas, ascendencias, ligas y fuentes de mercado.
5. Mantener Crafting y Mentor bloqueados en cualquier área sin evidencia nueva.
6. Ejecutar la barrera `verify:1.0` y los recorridos manuales de jugador nuevo y
   experto antes de cambiar el parche predeterminado.

El contrato completo está en `docs/POE2-1.0-READINESS.md`.

## 4. Después de estabilizar el núcleo

- [ ] Conversación persistente del Mentor entre sesiones y mejor seguimiento de
  proyectos de Crafting largos, sin convertir al LLM en fuente de verdad.
- [ ] Personalización de la mascota: nombre, voz textual, intensidad de avisos y
  preferencias de movimiento.
- [ ] Armario de skins reconocibles de clases o personajes de PoE, únicamente
  si Grinding Gear Games concede autorización escrita para ese uso.
- [ ] Las skins deben conservar la identidad reconocible que busca el jugador;
  no se sustituirán por arquetipos genéricos solo para rellenar el armario.
- [ ] No se extraerán modelos, texturas ni archivos del cliente. Antes de crear
  la capacidad pública se enviarán a GGG mockups, atribución, finalidad y modelo
  de monetización para aprobación.
- [ ] Cosméticos puramente visuales: nunca cambiarán la calidad de las respuestas
  ni otorgarán capacidades superiores al Mentor.

Referencia para la decisión de skins:
<https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy>

## 5. Regla de prioridad

Una mejora entra en el trabajo inmediato solo si aumenta al menos una de estas
capacidades: exactitud, comprensión, seguridad de una decisión, recuperación de
un error o preparación verificable para 1.0. Música, skins y otros cosméticos se
mantienen detrás de la estabilidad de Crafting y de la barrera de publicación.
