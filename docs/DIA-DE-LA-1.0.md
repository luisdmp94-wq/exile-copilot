# El día de la 1.0 (11-12-2026)

Lista corta para dejar la web al día cuando salga la 1.0. Va en orden.
El proceso formal de compatibilidad (evidencias, `DEFAULT_PATCH`) está en
[POE2-1.0-READINESS.md](POE2-1.0-READINESS.md); aquí solo se enlaza.

## Antes (hasta el 10-12)

1. `npm run data:status` → todo en verde para 0.5.5.
2. Textos para avisar en Steam y Reddit listos (`docs/promo/`, `LANZAMIENTO.md`).
3. Buscar a **una persona que no conozca la web** para el recorrido de
   «jugador nuevo» del día 11 o 12. Sin ella, `verify:1.0` no pasa.
4. Decidir qué hacer con Essences y Alloys (ver el ensayo, punto 6).

## El día del parche

**1. Ver qué ha cambiado.**

```
npm run data:status -- --online --target 1.0
```

Cada línea en ⚠ dice qué comando o archivo toca.

**2. Árbol de pasivas** (tarjeta «Tu árbol de pasivas» y el Mentor).
Cuando GGG suba el árbol nuevo a `grindinggear/poe2-skilltree-export`:

```
npm run data:tree -- --latest
```

- Mirar el resumen: «notables sin nombre en español» debe ser 0. Si no,
  poe2db aún no tiene la 1.0: repetir más tarde.
- Si el mensaje del commit de GGG no dice la versión: añadir `--label 1.0`.
- `npx vitest run tests/unit/passiveTree.test.ts`
- Hasta que se haga, quien pegue un código de PoB2 de la 1.0 ve el aviso
  «Tu código es del árbol 1.0 y la web usa el 0.5».

**3. Gemas** (consejero de gemas, revisión rápida, Mentor). Cuando poe2db tenga la 1.0:

```
npm run data:gems
npm run data:gems -- --en
```

**4. Path of Building 2 en la web** («Tus números con PoB2», el editor del
árbol y «Exportar a PoB2»). Cuando PoB2 publique su versión para la 1.0
(suele ser el mismo día o al siguiente):

```
npm run data:pob -- --latest
npm run data:items-en
```

- `data:pob` descarga PoB2, lo pasa a Lua 5.2, lo arranca en Node y calcula
  una build de prueba: si algo falla, no escribe nada. El resumen dice
  cuántas clases y gemas trae.
- Si PoB2 aún no tiene el árbol de la 1.0, el motor sigue con el 0.5 y los
  códigos nuevos dan números raros: esperar a su versión.
- `data:items-en` rehace la traducción de objetos en español (modificadores,
  bases y únicos de poe2db).
- `npx vitest run tests/integration/pobEngine.test.ts tests/unit/pobBuild.test.ts`

**5. Guías por acto.** Jugar cada acto (o mirar poe2db) y comprobar zonas,
jefes y recompensas. Al terminar, cambiar `checkedPatch` y `checkedOn` en
`src/guides/actOne.ts` … `actFour.ts` (y los `En`). Si la 1.0 trae actos
nuevos, son guías nuevas.

**6. Parche y liga en la web.** Seguir
[POE2-1.0-READINESS.md](POE2-1.0-READINESS.md) (`npm run readiness:1.0`).
Lo mínimo, en este orden (así se hizo con la 0.5.5, ver el ensayo abajo):

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

**8. Subir.** `npx vitest run`, `npm run build`, las pruebas de humo, push.
Comprobar en exilecopilot.com que el árbol dice «árbol 1.0».

**9. Avisar.** Steam y Reddit, un par de días después del lanzamiento
(cuando la gente ya está en la campaña).

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
