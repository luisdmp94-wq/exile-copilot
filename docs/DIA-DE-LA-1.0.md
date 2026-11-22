# El día de la 1.0 (11-12-2026)

Lista corta para dejar la web al día cuando salga la 1.0. Va en orden.
El proceso formal de compatibilidad (evidencias, `DEFAULT_PATCH`) está en
[POE2-1.0-READINESS.md](POE2-1.0-READINESS.md); aquí solo se enlaza.

## Antes (hasta el 10-12)

1. `npm run data:status` → todo en verde para 0.5.5.
2. Textos para avisar en Steam y Reddit listos (`docs/promo/`, `LANZAMIENTO.md`).

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
En Render → Environment, cuando toque: `DEFAULT_PATCH` y `DEFAULT_LEAGUE`
(la liga nueva).

**7. Builds destacadas.** Las de 0.5.5 se apartan solas. Buscar builds de la
1.0 con autor y fuente visibles.

**8. Subir.** `npx vitest run`, `npm run build`, las pruebas de humo, push.
Comprobar en exilecopilot.com que el árbol dice «árbol 1.0».

**9. Avisar.** Steam y Reddit, un par de días después del lanzamiento
(cuando la gente ya está en la campaña).
