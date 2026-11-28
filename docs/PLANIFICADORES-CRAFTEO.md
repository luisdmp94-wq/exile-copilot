# Planificadores de crafteo avanzado (tarea 19)

Rama `planificadores-crafteo`, carpeta `exile-copilot-planificadores`. Hecho el
28-11-2026. **Apagado en la web publicada**: va detrás del mismo interruptor
que Essences y Alloys (`advanced-crafting` en
`server/data/patchCompatibility.json`, «review-required»). Para verlo en local:
servidor `planificadores-7212`, abrir con `?avanzado=1`, Crafting → «Banco
manual» con una pieza **pegada** (las del ejemplo bloquean las herramientas).

## Qué son

Cinco tarjetas que leen la pieza pegada y contestan primero: si la moneda se
puede usar y qué va a pasar. Ninguna crea sesión ni cambia el formato guardado.
Vienen de la versión de septiembre (rama `crafting-real-item-coach`), donde el
jugador tenía que copiar el nombre y la descripción de cada moneda y marcar
tres casillas antes de ver nada. Aquí el texto de cada moneda sale del juego
(poe2db en español y en inglés, leído el 28-11-2026 con el parche 0.5.5).

| Pestaña | Regla (`shared/`) | Tarjeta (`src/components/`) |
| --- | --- | --- |
| Orbe fracturante | `craftingFracturing.ts` | `FracturingPlanner.tsx` |
| Mechón de Hinekora (previsión) | `craftingForesight.ts` | `ForesightPlanner.tsx` |
| Orbes de sacrificio | `craftingSacrifice.ts` | `SacrificePlanner.tsx` |
| Emociones líquidas | `craftingEmotions.ts` + `craftingEmotionData.ts` | `EmotionPlanner.tsx` |
| Flujos | `craftingFluxes.ts` | `FluxPlanner.tsx` |

Lo común está en `shared/craftingPlannerRules.ts` (estados de la pieza, qué es
una joya, «elimina un modificador aleatorio», parche) y en
`src/components/CraftingPlannerCard.tsx` (el marco de la tarjeta y la lista de
modificadores, que se marcan con un toque como «quiero conservar»).

Regla de la casa: «No se puede» solo cuando el texto del objeto o un estado de
la pieza lo impiden sin duda. Lo que el texto no dice queda en «Faltan datos» y
la tarjeta lo dice tal cual.

## Lo que dice el juego (28-11-2026)

### Mechón de Hinekora — `/sp/Hinekoras_Lock`, `/us/Hinekoras_Lock`

- En español el juego lo llama **«Mechón de Hinekora»**, no «Cierre».
- «Permite que un objeto anticipe el resultado del próximo objeto monetario que
  se va a usar sobre él» · «Si modificas el objeto de alguna forma, se pierde
  la capacidad de anticipación».
- La tarjeta dice si se le puede poner y para qué sirve con esa pieza (con
  modificadores marcados: antes de una moneda que quita o fija uno al azar).
- **No se sabe y se dice:** si se puede poner en una pieza corrupta; qué pasa
  si el resultado no gusta y se mira otra moneda distinta.

### Orbes de sacrificio — `/sp/Yaomacs_Orb_of_Sacrifice` y los otros tres

- Son cuatro, uno por tipo de pieza: Yaomac (arma o carcaj), Kopec (armadura),
  Kamasa (amuleto, anillo o cinturón) y Yugul (joya). Los cuatro: «Mejora un
  encantamiento corrupto de … raro/a · Y elimina un modificador aleatorio», y se
  aplican con «clic izquierdo en un objeto corrupto».
- La tarjeta dice cuál toca, si se puede usar (rara, corrupta, con
  encantamiento) y la probabilidad de perder un modificador marcado.
- **Errata del juego en español:** el texto del orbe de Yugul repite el de
  Kopec («una armadura rara»); el inglés dice «Rare Jewel». La tarjeta enseña
  el español tal cual y avisa.
- **No se sabe y se dice:** en qué se convierte cada encantamiento (poe2db
  lista 190 «Corrupted Upgrade Mods» sin decir de cuál sale cada uno); si un
  escudo, broquel o foco cuenta como «armadura»; si un modificador fracturado
  entra en el sorteo (entonces no da probabilidades).
- **Cambio en Crafting:** una pieza corrupta se quedaba en «Esta pieza no
  admite este craft» y nunca llegaba a las pestañas. Ahora, debajo de ese
  aviso, sale la tarjeta del orbe de sacrificio («Lo que sí admite una pieza
  corrupta»).

### Emociones líquidas — `/sp/Stackable_Currency`, `/us/Stackable_Currency`

- 26 en total: 13 para «joya básica rara» y 13 «antiguas» para «joya rara
  perdida en el tiempo». Todas: «Elimina un modificador aleatorio y mejora una
  joya … con un nuevo modificador de fabricación garantizado». Cuál, depende de
  la emoción y de la joya (rubí, zafiro, esmeralda o diamante); el juego lo
  lista entero.
- Los datos están en `shared/craftingEmotionData.ts`, **generado** por
  `node scripts/refresh-emotion-data.mjs` (baja las dos páginas, empareja
  inglés y español y falla si las listas no cuadran). No se edita a mano.
- La tarjeta: se elige la emoción en un desplegable y dice qué modificador le
  pondría a esa joya (prefijo o sufijo) y la probabilidad de perder uno
  marcado. Plegado, lo que pone cada una de las 13.
- **No se sabe y se dice:** si una joya que ya tiene un modificador de
  fabricación admite otro; qué hace con una joya sin modificadores.

### Flujos — `/sp/Blazing_Flux`, `/sp/Chilling_Flux`, `/sp/Crackling_Flux`, `/sp/Void_Flux`

- Cuatro de resistencias: ardiente (hielo y rayo → fuego), escarchante (fuego y
  rayo → hielo), electrizante (fuego y hielo → rayo) y del vacío (los tres →
  caos). Se aplican a «un objeto mágico o raro». No son de resistencias el
  «Flujo taumatúrgico» (gemas kalguranas) ni el «Flujo perfecto».
- Cada página trae una tabla «Mod Equivalencies» (15 filas). Entre fuego, hielo
  y rayo el rango no cambia; hacia caos baja (p. ej. 26–30 % → 16–19 %). Está
  en `FLUX_SINGLE_TO_CHAOS`, `FLUX_WITH_CHAOS_TO_CHAOS` y `FLUX_RADIUS_TO_CHAOS`.
- La tarjeta lee las líneas de resistencia de la pieza y dice, para cada flujo,
  cuáles cambian y en qué se quedan.
- **Errata del juego en español:** el texto del Flujo electrizante nombra
  «fuego, hielo y rayo» como origen; el inglés dice «Fire and Cold».
- **No se sabe y se dice:** si conserva el número exacto de la línea; qué pasa
  cuando quedarían dos líneas iguales del mismo elemento; si cambia las
  resistencias implícitas o de runa, o una línea fracturada. «+X % a todas las
  resistencias elementales» no sale en la tabla.

## Comprobado

- 55 pruebas nuevas (`tests/unit/craftingPlanners.test.ts` y
  `craftingFracturing.test.ts`).
- En el navegador (servidor aislado, IA apagada), con cuatro piezas de prueba
  pegadas: ballesta rara, anillo con resistencias, botas corruptas con
  encantamiento y un rubí raro. En español e inglés, en ordenador y en móvil
  (375 px, sin desbordar). Marcar un modificador con un toque cambia la
  probabilidad; elegir emoción cambia el modificador.
- Las piezas de prueba son inventadas (no salen de una partida): sirven para
  ver la tarjeta, no como dato del juego.

## Pendiente

- Nada de esto se ha usado en el juego: las reglas son el texto del objeto,
  no una prueba con la moneda en la mano.
- Encender el crafteo avanzado es decisión aparte, con la 1.0.
- Visto de paso, sin tocar: al pegar una **joya** en Crafting, la ficha dice
  «Todavía caben 3 más» (cuenta seis huecos como en el equipo). No he
  comprobado cuántos modificadores admite una joya: revisar antes de dar ese
  dato por bueno.
- En ordenador las pestañas quedan muy abajo en la página (debajo del plan de
  la pieza). Es la disposición de siempre de Essences y Alloys.
- Las líneas de la pieza salen en el idioma en que se pegó (igual que en el
  resto de la web).
