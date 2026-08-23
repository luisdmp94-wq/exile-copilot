# Taller unificado de Crafting

> Crafting abre con dos caminos evidentes. El banco técnico sigue existiendo
> entero, pero deja de ser la puerta de entrada.

## Los dos caminos

`CraftingSection` es ahora un enrutador delgado:

- **Quiero aprender crafting** → la Academia básica, sin cambios de alcance.
- **Ayúdame con mi objeto** → `CraftingCoach`, el modo por defecto.

Ambos comparten la pieza seleccionada. Ninguno desmonta al otro: cambiar de
camino no borra nada.

## Qué responde el guía, en este orden

1. **¿Qué objeto miramos?** `CoachItemCard` con su ilustración local y su rareza.
2. **¿Qué tiene ahora?** Una frase de `readItemInPlainWords()`: rareza, prefijos,
   sufijos y sitio libre, sin contadores sueltos ni jerga.
3. **¿Qué merece conservarse?** La lista de modificadores y la promesa que la
   evidencia respalda: estas cuatro monedas **solo añaden**, nunca quitan.
4. **¿Cuál es la única siguiente acción?** `chooseNextStep()`: nombre de la
   moneda, qué usar y sobre qué pieza, una frase de porqué, y aviso solo si hay
   una consecuencia estructural real. «Qué puede ocurrir» y «Evidencia técnica»
   llegan plegados.
5. **¿Cuándo parar?** Cuando ninguna moneda observada es compatible, o cuando
   falta un dato: el guía lo dice y no ofrece gastar.
6. **¿Qué salió?** El jugador pega el resultado y `readCraftResult()` traduce la
   comparación: qué cambió, qué se conservó, continuar o parar.

## Decisiones que podrían parecer inventadas y no lo son

**Desempate entre monedas compatibles.** Un mágico con hueco admite Aumento y
Regio. `buildCraftingRoute` se niega expresamente a ordenarlas como mejor o
peor, y el guía respeta esa negativa: propone la que **no cambia la rareza**,
porque la otra seguirá disponible después y esa no. La regla sale de
`EXPECTED_RESULT_RARITY`, y se enseña al jugador tal cual.

**Avisos.** Solo dos, y ambos comprobables: cambiar de rareza cierra las monedas
que exigían la anterior, y quedarse a un hueco del límite observado significa
que después no cabrá nada.

**La dirección no cambia lo que es legal.** Elegir daño o defensa no altera qué
moneda es compatible —eso lo decide la estructura—. Sirve para leer el resultado
después, comparando etiquetas con `evaluateCraftingGoalSignal`. El guía lo dice
en vez de fingir una recomendación personalizada.

**«No sé qué necesita»** solo se activa cuando las etiquetas de la propia pieza
inclinan la balanza. Sin modificadores, con empate o con etiquetas ajenas a daño
y defensa, el botón queda desactivado con su explicación. No existe evidencia
local sobre qué admite cada base, así que **nunca** se descarta una dirección por
el tipo de objeto.

## Qué se reutilizó de `bb06b1f`

De `crafting-real-item-coach` se conserva la **idea**: reducir el banco a una
decisión por pantalla y cortar antes de gastar cuando falta un dato. No se portó
su código: `buildCraftingCoachStep` orquesta los pasos del banco («Paso 2 de 3 ·
Parada», «Objetivo») y ese vocabulario es justo el que este trabajo elimina del
recorrido principal. `shared/craftingCoach.ts` se reescribió sobre los mismos
motores, con contratos propios y lenguaje de jugador.

## Herramientas avanzadas

El banco entero —objetivos, protecciones, condiciones de parada, Essences,
Alloys, sesiones y comparaciones— vive tras un botón plegado con la descripción
«Control manual de objetivos, protecciones y monedas». Sigue **montado**: su
estado no se pierde. No se abre al pegar una pieza. Sí se abre solo cuando hay
un craft en marcha, porque si no quedaría inalcanzable.

## Un fallo latente que salió aquí

El atributo `hidden` no ocultaba nada cuando el elemento llevaba además una
utilidad de display de Tailwind (`flex`, `grid`…): son reglas de autor y ganan al
`[hidden] { display: none }` del navegador. El banco seguía visible y, peor,
**enfocable con teclado** estando «oculto». `src/index.css` restituye la
semántica en toda la aplicación.

## Móvil

El mentor contextual publica su altura real en `--mentor-inset` mediante un
`ResizeObserver`; `<main>` reserva ese espacio y las tarjetas del guía llevan
`scroll-margin-bottom` con el mismo valor, de modo que al mover el foco la
decisión queda por encima del panel. En pantallas pequeñas el mentor desplegado
se limita a 42vh. El smoke lo comprueba **midiendo rectángulos durante la
interacción**, con el mentor plegado y desplegado, no en una captura.

## Límites conocidos

- El guía razona sobre la pieza que el jugador pega, pero **no escribe en el
  expediente**: aplicar el resultado al personaje sigue siendo del banco.
- Solo cubre las cuatro monedas observadas. Essences y Alloys siguen en
  herramientas avanzadas porque exigen su propio tooltip verificado.
- Con el mentor desplegado en móvil, una tarjeta muy alta puede exceder el
  espacio libre; lo garantizado —y comprobado— es que la decisión y sus botones
  son alcanzables desplazándose.
- El progreso del guía es de sesión: sobrevive al cambio de modo, no a recargar.
  La pieza sí, porque vive en el expediente.
