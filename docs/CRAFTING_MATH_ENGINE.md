# Motor matemático de crafting

## Qué resuelve

`shared/craftingProbability.ts` calcula una selección ponderada de **un**
modificador cuando recibe un snapshot cuyo alcance, candidatos, pesos y
elegibilidad están verificados como completos. Devuelve:

- peso elegible total y peso del objetivo;
- probabilidad exacta de un intento;
- intentos medios geométricos;
- probabilidad acumulada tras varios intentos;
- coste esperado, solo si el coste por intento está verificado y fechado.

`shared/craftingStrategy.ts` combina probabilidades condicionales de estados
sucesivos. Calcula la probabilidad de completar una pasada y el coste esperado
de esa pasada. El coste hasta acertar solo aparece si una fuente demuestra que
cada fallo puede volver al mismo estado inicial y aporta el coste de reinicio.

## Invariantes de honestidad

1. `null` es desconocido; `0` es un peso conocido que no puede salir.
2. Un pool parcial, observado o ausente nunca produce un porcentaje.
3. Un candidato con elegibilidad desconocida impide declarar el pool completo.
4. Los candidatos bloqueados no entran en el denominador y deben explicar por
   qué están bloqueados.
5. Las monedas distintas no se suman ni se comparan sin normalización externa.
6. El motor no decide si un mod es bueno: el objetivo debe usar ids, grupos o
   tags que la capa de conocimiento haya verificado.
7. Las secuencias no presuponen independencia. Cada paso recibe la probabilidad
   condicional correspondiente al estado dejado por el anterior.
8. No se supone que un objeto fallido pueda reiniciarse gratis o siquiera pueda
   reiniciarse.

## Lo que todavía falta

Este motor no contiene pools reales de PoE2. La capa `server/crafting` debe
aportar snapshots versionados con parche, alcance y procedencia. Hasta que no
exista un snapshot `verified-complete`, la interfaz debe mostrar «probabilidad
no disponible» y sus motivos, nunca `0 %`.

Los fixtures de las pruebas son sintéticos y están nombrados como tales. Solo
demuestran las matemáticas y los frenos del contrato; no describen mods, pesos
ni estrategias reales del juego.
