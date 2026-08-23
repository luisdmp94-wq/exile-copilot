# Auditoría adversarial de Crafting — 23/08/2026

## Alcance

Auditoría de código y recorrido real en navegador sobre `main` (`9b73a2a` al
comenzar), usando la ballesta avanzada `Núcleo de fénix` y un servidor aislado.
Se recorrió el ciclo completo:

1. entrada «Evaluar o craftear»;
2. importación de objeto suelto;
3. diagnóstico y selección de Exaltado;
4. preflight antes del gasto;
5. comparación de un resultado sin cambios;
6. comparación de un resultado con un modificador añadido;
7. valoración subjetiva y actualización del mismo objeto;
8. diagnóstico de la pieza ya llena.

No se usaron precios, probabilidades ni pools de afijos no verificables.

## Evidencia autoritativa utilizada

- Texto avanzado aportado por el jugador y capturas de los cuatro grupos de
  monedas, fechadas el 22/08/2026.
- Contrato oficial `Item` de GGG para estados como `corrupted`, `split`,
  `sanctified`, `unmodifiable`, `mutated` y `desecrated`:
  <https://www.pathofexile.com/developer/docs/reference>.
- Registro local versionado de acciones y su fecha de corte. Los pools siguen
  marcados como insuficientes; por eso no se calcula una probabilidad.

## Hallazgos

### P1 — una base normal aparecía bloqueada aunque Transmutación era legal

`diagnoseCraftingItem()` trataba cualquier rareza sin límite total conocido
como fuera de alcance y también consideraba la ausencia de explícitos un
bloqueo universal. Esto contradecía a `evaluateObservedCraftingActions()`, que
sí habilitaba Transmutación para un objeto normal sin afijos.

Impacto: el primer paso natural de un craft podía mostrar simultáneamente
«Diagnóstico bloqueado» y una acción compatible.

Corrección: normal pasa a ser una rareza soportada con cero explícitos; una
base normal con explícitos sigue siendo inconsistente y se bloquea.

### P1 — el jugador volvía a una lista, no a una decisión

La app ya cerraba muy bien el ciclo antes/después, conservaba el mismo `itemId`
y, tras el resultado, actualizaba el objeto. Sin embargo, el diagnóstico solo
decía «indica qué buscas» o «bloquear acciones» y dejaba al jugador explorar
tres familias de herramientas sin una salida visible.

Corrección: se añadió una ruta derivada únicamente de compatibilidad demostrada:

- una moneda legal → CTA directo para preparar esa moneda;
- varias monedas legales → muestra todas sin inventar un ranking;
- raro lleno → explica que hace falta reemplazar y lleva a Essence o Alloy;
- lectura parcial → «No gastes todavía» y vuelve a importar.

### P2 — estados especiales podían parecer una lectura completa

La ausencia de `craftingState`, o estados como dividido, sin identificar,
mutado o profanado, no impedían que el diagnóstico general mostrase la pieza
como lista, aunque la evaluación por moneda devolvía `needs-data`.

Corrección: esos casos son ahora lectura parcial y nunca producen una ruta de
gasto.

### P2 — el objetivo sigue siendo una declaración del jugador

El sistema comprueba cambios estructurales, pero no puede concluir que
«+10 Fuerza» sea bueno para una build solo porque el jugador escribió «más
daño». La pregunta final «¿te sirve?» es deliberada y correcta.

Corrección conservadora posterior: el jugador puede clasificar su objetivo y
la comparación busca una señal directa solo en las etiquetas literales del
texto avanzado. No se analiza el nombre ni la prosa del modificador. La ausencia
de coincidencia no se convierte en fracaso y la decisión final sigue siendo del
jugador.

## Bloque elegido e implementado

**Ruta de próxima decisión segura.** Es el bloque de mayor valor inmediato
porque une diagnóstico, herramienta y siguiente clic sin ampliar el modelo de
datos ni hacer afirmaciones nuevas sobre PoE2.

Contratos nuevos:

- `buildCraftingRoute()` es puro y determinista;
- no interpreta el texto de los afijos;
- no elige un camino cuando hay más de uno;
- no declara compatible una Essence o Alloy sin su tooltip;
- nunca convierte ausencia de datos en probabilidad cero.

## Riesgos que permanecen abiertos

1. No existe todavía un pool de afijos completo, versionado y con licencia
   redistribuible; las probabilidades permanecen desactivadas.
2. La señal por etiquetas no mide magnitud, sinergias indirectas ni utilidad
   global para la build. Haría falta contexto verificable del personaje y una
   taxonomía más rica antes de automatizar esa valoración.
3. Las reglas observadas pueden cambiar tras un parche; el corte de datos debe
   seguir visible y revisarse cuando cambie la versión del juego.
4. Essence y Alloy dependen del tooltip que el jugador tiene delante. Esto es
   una limitación consciente, no un fallback silencioso.
