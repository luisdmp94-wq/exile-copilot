# El día de la 1.0 (11-12-2026)

Lista corta para dejar la web al día cuando salga la 1.0. Va en orden.
El proceso formal de compatibilidad (evidencias, `DEFAULT_PATCH`) está en
[POE2-1.0-READINESS.md](POE2-1.0-READINESS.md); aquí solo se enlaza.

## Cuánto tarda (medido en el ensayo del 25-11-2026)

| Paso | Qué | Tiempo de máquina |
| --- | --- | --- |
| 1 | `data:status` | 2 s |
| 2 | Árbol + su prueba | 12 s + 4 s |
| 3 | Gemas en español y en inglés | 2 min 40 s + 1 min |
| 4 | PoB2 + traducción de objetos + sus pruebas | sin medir + 2 min 10 s + 10 s |
| 5 | Guías por acto | a mano: lo que se tarde en mirar cada acto |
| 6 | Parche y liga | a mano; la auditoría tarda 2 s |
| 8 | `verify:release` | sin medir (no se lanza con Luis jugando) |

Los scripts son unos **6 minutos**. Lo largo es esperar a las fuentes (GGG,
poe2db, PoB2) y los pasos 5 y 6, que son a mano.

## Antes (hasta el 10-12)

1. `npm run data:status` → todo en verde para 0.5.5.
2. Textos para avisar listos: `docs/promo/lanzamiento-1.0.md` y la guía de
   Steam en `docs/promo/guia-steam-acto-1.md`.
3. Buscar a **una persona que no conozca la web** para el recorrido de
   «jugador nuevo» del día 11 o 12. Sin ella, `verify:1.0` no pasa.
4. Decidir qué hacer con Essences y Alloys (ver el ensayo, punto 6).
5. Un día que Luis no juegue: `npm run data:pob` una vez. Deja la copia de
   PoB2 descargada en `.tmp/pob2` (el repositorio pesa cientos de MB), así el
   día 11 debería bajar solo lo nuevo. Apuntar en la tabla de arriba cuánto
   tarda. No debe cambiar ningún archivo salvo la fecha de `meta.json`.

## El día del parche

**Orden y esperas.** Cada fuente publica a su hora. Los pasos 2, 3 y 4 se
hacen según lleguen, con una regla: **las gemas (3) van antes que PoB2 (4)**,
porque `data:pob` lee los nombres de las gemas. Si poe2db llega después de
PoB2, repetir `data:pob` al final. Mientras tanto la web sigue funcionando con
los datos de la 0.5.5 y dice «PoE2 0.5.5»: no hay que correr.

**1. Ver qué ha cambiado.**

```
npm run data:status -- --online --target 1.0
```

Cada línea en ⚠ dice qué comando toca y en qué paso de esta lista está.
Se puede repetir las veces que haga falta: no cambia nada.

- «último de GGG» en ⚠ = ya hay árbol nuevo (paso 2).
- «versión publicada» de PoB2 en ⚠ = PoB2 ya ha sacado la suya (paso 4).
  «último de PoB2» cambia casi cada día y por sí solo no significa nada.
- poe2db no avisa: se sabe al pasar el paso 3 (su resumen).

**2. Árbol de pasivas** (tarjeta «Tu árbol de pasivas» y el Mentor).
Cuando GGG suba el árbol nuevo a `grindinggear/poe2-skilltree-export`:

```
npm run data:tree -- --latest
npx vitest run tests/unit/passiveTree.test.ts
```

- La línea «nodos:» del resumen dice cuántos son nuevos, cuántos ya no están
  y cuántos cambian de texto.
- «notables sin nombre en español» debe ser 0. Si no, poe2db aún no tiene la
  1.0: repetir más tarde. La prueba falla por lo mismo hasta entonces
  («trae el árbol entero con nombres en español…»): es el aviso, no un fallo.
- Si el mensaje del commit de GGG no dice la versión: añadir `--label 1.0`.
- Hasta que se haga, quien pegue un código de PoB2 de la 1.0 ve el aviso
  «Tu código es del árbol 1.0 y la web usa el 0.5».

**3. Gemas** (consejero de gemas, revisión rápida, Mentor). Cuando poe2db tenga la 1.0:

```
npm run data:gems
npm run data:gems -- --en
```

- Al acabar, cada uno dice qué gemas son nuevas, cuáles ya no están y cuáles
  cambian de texto. **«poe2db no ha cambiado ninguna gema» = aún no tiene el
  parche**: repetir más tarde.
- El español y el inglés de poe2db no van a la par (el 25-11 el inglés había
  cambiado 118 textos y el español ninguno). Las reglas usan el español: es el
  que manda. Si solo ha cambiado el inglés, esperar.
- Si salen gemas «que ya no están», mirar que el juego las ha quitado de
  verdad antes de subir.

**4. Path of Building 2 en la web** («Tus números con PoB2», el editor del
árbol y «Exportar a PoB2»). Cuando PoB2 publique su versión para la 1.0
(suele ser el mismo día o al siguiente), y **después del paso 3**:

```
npm run data:pob -- --latest
npm run data:items-en
npx vitest run tests/integration/pobEngine.test.ts tests/unit/pobBuild.test.ts
```

- `data:pob` descarga PoB2, lo pasa a Lua 5.2, lo arranca en Node y calcula
  una build de prueba: si algo falla, no escribe nada. El resumen dice
  cuántas clases y gemas trae. `--latest` es la rama de desarrollo de PoB2.
- La descarga es grande: no lanzarla con Luis jugando o en directo.
- Si PoB2 aún no tiene el árbol de la 1.0, el motor sigue con el 0.5 y los
  códigos nuevos dan números raros: esperar a su versión.
- `data:items-en` rehace la traducción de objetos en español (modificadores,
  bases y únicos de poe2db). Su resumen dice qué traducciones se pierden: en
  un parche normal son pocas (el 25-11, 10 modificadores y 2 únicos que
  poe2db había quitado). Si son cientos, poe2db ha cambiado de formato: no subir.

**5. Guías por acto.** Jugar cada acto (o mirar poe2db) y comprobar zonas,
jefes y recompensas. Repasar los dos textos (`actOne.ts` y `actOneEn.ts`, y
así los cuatro actos). Al terminar, cambiar `checkedPatch` y `checkedOn`
**solo en el archivo en español** (`src/guides/actOne.ts` … `actFour.ts`): el
inglés los hereda. Si la 1.0 trae actos nuevos, son guías nuevas.

- La ventanita (rama `ventanita-guia`) usa estas mismas guías: después de
  este paso, llevar los cambios a su rama.
- La ruta de pasivas «bruja-caos-esbirros» sale en ⚠ pero no se ve en la
  web: puede esperar a después del lanzamiento.

**6. Parche y liga en la web.** Seguir
[POE2-1.0-READINESS.md](POE2-1.0-READINESS.md) (`npm run readiness:1.0`).
Antes del 11-12 la auditoría lo da todo por bloqueado por la fecha: es lo
esperado. Lo mínimo, en este orden (así se hizo con la 0.5.5, ver el ensayo abajo):

- Registro de pasivas del importador `.build`: es **otro** archivo que el de
  `data:tree`. En `scripts/build-passive-registry.ts` poner commit, SHA-256,
  bytes, fecha y `TESTED_AGAINST_PATCH` del export nuevo; generarlo con
  `--input`; añadirlo arriba de `REGISTRY_FILES` en
  `server/registry/passiveRegistry.ts` con id `passive-registry.<commit>`.
- Fuentes en `docs/evidence/1.0/` (notas oficiales leídas, captura de
  poe.ninja) y una evidencia por área con `npm run record:evidence`.
- Ficha `1.0` en `patchCompatibility.json` y `patches.json` (con la letra
  de hotfix más reciente).
- En Render → Environment: `DEFAULT_PATCH` y `DEFAULT_LEAGUE` (la liga que
  poe.ninja indexe, no siempre la de evento).

**7. Builds destacadas.** Las de 0.5.5 se apartan solas. Buscar builds de la
1.0 con autor y fuente visibles.

**8. Subir.** Con Luis sin jugar ni emitir:

```
npm run verify:release
```

Hace el lint, `npm run build`, la batería completa, los dos simulacros de
copia y reinicio y las ocho pruebas de humo. Si todo pasa, push (con el sí de
Luis). Comprobar en exilecopilot.com que el árbol dice «árbol 1.0» y que
`npm run data:status -- --target 1.0` ya no tiene ⚠ de datos.

**9. Avisar.** Textos en `docs/promo/lanzamiento-1.0.md`. Steam y Reddit, un
par de días después del lanzamiento (cuando la gente ya está en la campaña).
**No pegar nada hasta acabar el paso 8**, y repasar antes lo que los textos
dicen de los actos.

## Ensayo del 25-11-2026 (tarea 10 del plan)

Se siguieron los pasos como si la 1.0 saliera ese día, con los datos de la
0.5.5. Para el paso 2 se simuló un árbol distinto (el 0.5.2 con etiqueta
«1.0»). Luis estaba jugando: no se lanzó ni la descarga de PoB2 ni
`verify:release`.

**Dónde se atascó (ya arreglado):**

1. **No se veía qué había cambiado.** Los archivos de datos son de una línea
   o de miles: el `git diff` no se lee. Así, el objetos es→en perdió 10
   modificadores y 2 únicos sin decir nada. Ahora `data:tree`, `data:gems` y
   `data:items-en` acaban con un resumen (nuevas, quitadas, cambiadas).
2. **No había forma de saber si poe2db ya tenía el parche.** El resumen de
   gemas lo dice («no ha cambiado ninguna gema»).
3. **`data:status` daba las gemas por buenas** el día del parche: solo miraba
   que tuvieran menos de 30 días. Ahora, si se leyeron antes de la fecha de
   salida, avisa. Tampoco miraba la traducción de objetos: ya tiene su línea.
4. **«Hay cambios en PoB2» salía cada día** (mira la rama de desarrollo).
   Ahora hay una línea «versión publicada», que solo cambia cuando PoB2 saca
   versión.
5. **Dos pruebas del árbol habrían fallado sin motivo** el día 11: llevaban
   escrito «0_5». Ahora usan la versión del árbol que haya.
6. **El orden gemas → PoB2 no estaba escrito.** `data:pob` lee los nombres de
   las gemas.
7. **El documento apuntaba a sitios viejos:** `LANZAMIENTO.md` (los textos
   están en `docs/promo/lanzamiento-1.0.md`) y «los `En`» de las guías (el
   inglés hereda `checkedPatch`).
8. El paso 8 no decía el comando. Es `npm run verify:release`.
9. Aviso de Git «LF will be replaced by CRLF» en las gemas: arreglado en
   `.gitattributes`.

**Sin ensayar (y por qué):**

- `data:pob -- --latest`: la copia de PoB2 no estaba descargada y el
  repositorio pesa cientos de MB. Queda como punto 5 de «Antes».
- `verify:release`: pesado. Se pasa en la tarea 11 (congelar).
- El paso 6 con datos reales: la auditoría no deja antes del 11-12. Se
  ensayó con la 0.5.5 el 22-11 (abajo).

**Visto de paso:** poe2db en inglés ya trae dos gemas que el español no tiene
(Demon Magus, Shroud) con textos internos. No estorban (la web une las gemas
por su identificador y manda el español), pero conviene mirarlas el día 11.

## Ensayo con la 0.5.5 (22-11-2026)

Se revisó la 0.5.5 con este mismo proceso. Resultado: la web puede trabajar
con 0.5.5 con límites visibles; la barrera estricta (`readiness:0.5.5`) sigue
**bloqueada** en 4 de 14 puntos. Fuentes en `docs/evidence/0.5.5/`.

**Qué falló (ya arreglado):**

1. `data:status` decía «todo al día» sin mirar la compatibilidad: la web
   seguía en 0.5.4f. Ahora tiene la línea «Compatibilidad».
2. El registro de pasivas del `.build` no estaba en esta lista y solo admitía
   un archivo: cambiarlo rompía el parche anterior hasta tocar Render. Ahora
   conviven varios y cada parche usa el suyo.
3. Su id (`passiveRegistry.…`) no cumple el formato de `record:evidence`
   (solo minúsculas). Los nuevos se llaman `passive-registry.<commit>`.
4. El mercado exigía el id fijo de 0.5.4f (`poe-ninja-economy-endpoint`),
   y la auditoría prohíbe reutilizarlo: la 1.0 nunca habría tenido mercado.
   Ahora vale la evidencia de mercado de cada parche.
5. Las huellas SHA-256 se calculan sobre bytes y Git en Windows cambia los
   fines de línea. `.gitattributes` fija LF en las fuentes y recibos nuevos.

**Qué sigue bloqueado y por qué (solo se puede hacer en el juego):**

- Copias de objetos con `Ctrl+Alt+C` del cliente, en español y en inglés
  (`npm run record:item-sample`).
- Volver a observar Transmutación, Aumento, Regio y Exaltado en el cliente:
  las únicas observaciones son del 22-08. La web las sigue usando con aviso,
  pero la auditoría estricta no las acepta para un parche nuevo.
- Dos recorridos reales (jugador nuevo y experto) con
  `npm run record:walkthrough`.
- Essences y Alloys: siguen detenidos (ver punto 6).

**Qué sobra o hay que decidir:**

6. La barrera estricta exige las cinco áreas abiertas, también Essences y
   Alloys, que ni la 0.5.4f tenía. Tal como está, `verify:1.0` no puede pasar
   sin revisar Essences y Alloys una a una. O se revisan antes del 11-12, o se
   acepta un área detenida si su bloqueo se ve en la web.
7. La regla «no cambiar `DEFAULT_PATCH` hasta cerrar todo» deja la web
   diciendo un parche viejo durante semanas. Con la 0.5.5 se cambia con
   cobertura `limited` y evidencias propias; la barrera estricta queda para
   poder decir «comprobado del todo».
8. GGG publica muchas letras de hotfix (0.5.5b … 0.5.5h). El id del parche
   es el de contenido (`0.5.5`, `1.0`) y `hotfix` guarda la última letra
   revisada. Leer el índice del foro, no hilo a hilo:
   https://www.pathofexile.com/forum/view-forum/2212
9. poe.ninja solo indexó la liga principal (Runes of Aldur), no la de evento
   (Forbidden Rites). El día 11, mirar `index-state` antes de poner
   `DEFAULT_LEAGUE`.
