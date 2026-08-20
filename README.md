# Exile Copilot

Aplicación web para jugadores de **Path of Exile 2**. Su núcleo es un mentor
persistente que conoce el personaje, recuerda decisiones y mantiene una sola
próxima acción:

> «Importa tu build, indica tu presupuesto y recibe las próximas mejoras ordenadas por impacto, coste y riesgo.»

No es un chatbot genérico: construye un perfil estructurado del personaje,
consulta datos verificables (API económica pública documentada de poe.ninja),
devuelve acciones concretas y conserva el resultado de cada decisión en el
diario del personaje. Mientras haya un paso activo no genera tareas paralelas;
si una mejora ya se intentó, exige reconciliar el resultado con el perfil antes
de repetirla.

## Requisitos

- Node.js 24+ (usa `node:sqlite`, sin dependencias nativas)
- npm
- (Opcional, solo para `npm run test:browser`) Microsoft Edge instalado

## Puesta en marcha

```bash
npm install
cp .env.example .env   # opcional; todos los valores tienen default
npm run dev            # frontend + API en http://localhost:7100
```

- `npm run dev` — servidor de desarrollo único (Vite sirve el frontend y monta la API Express bajo `/api`).
- `npm start` — modo producción: sirve `dist/` + API en el puerto `PORT` (default 7177). Requiere `npm run build` previo.
- `npm run build` — typecheck completo (`tsc -b`) + build de producción.
- `npm test` — pruebas automatizadas (unitarias, integración y e2e del flujo principal).
- `npm run lint` — ESLint sobre todo el repo.
- `npm run test:browser` — prueba real de navegador del flujo principal con Edge (Playwright, `channel: msedge`, sin descargar navegadores). `--dev` la ejecuta contra el servidor de desarrollo (Strict Mode), `--all` contra ambos. Requiere `npm run build` previo para el modo producción. Guarda capturas en `docs/screenshots/`.
- `npm run test:journal` — prueba del flujo persistente del mentor en una base temporal; acepta también `--dev` y `--all` y nunca modifica los datos del usuario.
- `npm run test:mentor` — prueba de navegador de la conversación con el mentor (Hito 6A) en una base SQLite temporal; acepta `--dev`, `--all` y `--update-screenshots`.

## Cómo probar el flujo principal (sin credenciales)

1. Abre http://localhost:7100 y pulsa **«Cargar ejemplo»** (perfil demo: Mercenario Gemling con ballesta, nivel 70, con carencias deliberadas).
2. Revisa/corrige campos en **Mi personaje** (atributos, resistencias, vida y defensas; «Desconocido» = sin dato, nunca 0) y pulsa **Guardar correcciones**. El personaje se recupera automáticamente al recargar la página (el id solo se guarda tras persistir de verdad en el servidor).
3. Importa un **`.build` oficial** de GGG: se añade como **Build objetivo** (plan de referencia), no como personaje. Un código de **Path of Building** sí rellena un personaje parcial.
4. En **Mercado actual** elige liga, presupuesto y objetivo; consulta precios (datos reales de poe.ninja con caché; tasas de conversión con origen y verificación visibles).
5. Pulsa **Generar recomendaciones** → 3 tarjetas con prioridad, acción, motivo, coste, impacto, riesgo, irreversibilidad, parche, fuentes, fecha y confianza. Si cambias cualquier dato, las tarjetas se invalidan.
6. Guarda una recomendación como **próximo paso**. Cuando la ejecutes, el mentor
   espera el resultado real antes de cerrarla y conserva decisión, contexto,
   fuentes y resultado en el historial del personaje.
7. Marca las recomendaciones aplicadas y pulsa **Descargar .build** → archivo
   **`.build` oficial** (GGG Build Planner v1) con las mejoras planificadas
   incrustadas, junto a un informe honesto de lo exportado y lo omitido.

## Formato `.build` — GGG Build Planner v1

El archivo exportado sigue el esquema oficial documentado por GGG en
<https://www.pathofexile.com/developer/docs/game>: un único objeto `Build` JSON con
`name`, `author`, `link`, `description`, `ascendancy`, `passives`, `skills` e `inventory_slots`.

Separación de conceptos:

- **CharacterProfileSnapshot** (`shared/domain.ts`): estado interno completo (nivel, liga, resistencias, vida, mods de objetos, presupuesto…).
- **GggBuildPlannerV1** (`shared/gggBuildPlanner.ts`): el archivo oficial exportable al juego.

El formato oficial **no puede almacenar** nivel, liga, parche, atributos, resistencias, vida/defensas, mods concretos de objetos, presupuesto ni objetivo. Además, pasivas y gemas solo se exportan cuando existe un **id oficial verificable** (tablas `PassiveSkills` / `BaseItemTypes`); lo que no lo tiene aparece en `skippedUnverified` del informe de exportación. Por tanto NO es un round-trip sin pérdida: la app informa siempre de lo omitido.
Los campos de un plan importado que el esquema v1 no documenta se conservan tal
cual (el importador los declara en los avisos) y se reexportan sin pérdida.

### Validación manual dentro del juego (2026-08-20)

Además de las pruebas automatizadas (que validan contra el esquema documentado,
no contra el juego), un archivo `.build` exportado por Exile Copilot —el plan
Titan Warrior con una mejora aplicada incrustada— se importó manualmente en
Path of Exile 2 real. El juego lo aceptó y mostró:

- Nombre y ascendencia («Titan Warrior», planificador del juego): [captura del árbol](docs/screenshots/ingame-arbol-pasivas.jpg).
- Las 34 pasivas del plan con sus rutas resaltadas en el árbol (misma captura).
- Las 4 habilidades: Boneshatter (Destrozahuesos), Earthquake (Terremoto),
  Infernal Cry (Grito infernal) y Shockwave Totem (Tótem de onda sísmica):
  [captura de habilidades](docs/screenshots/ingame-habilidades.jpg).
- Los 9 huecos de equipo con sus pistas, incluido el texto añadido al anillo
  «Mejora planificada: Cubrir resistencias elementales hasta el cap»:
  [captura del equipo](docs/screenshots/ingame-equipo-mejora-incrustada.jpg).

Esta validación manual cubre **ese archivo concreto** en esa sesión de juego;
no convierte a todos los exports en «probados en el juego».

## Registro de pasivas y ascendencias (Hito 4A)

Los ids de `passives` y `ascendancy` de un `.build` se resuelven a su **nombre
inglés oficial** con un registro interno derivado EXCLUSIVAMENTE del export
oficial del árbol de pasivas de GGG:

- Fuente: <https://github.com/grindinggear/poe2-skilltree-export> (`data.json`).
- Revisión fijada: commit `1e9eb2d8c1946398c3aaaacfbaead5c75c0d1fa6` (2026-06-15).
- SHA-256 del archivo original: `f83c94ce7b09f2bfc5b3b1d63523c2ab3d2582d0e964f6aeec34b8b0390abcfe` (5 141 380 bytes).
- Propietario de los datos: **Grinding Gear Games**. Licencia explícita: **no encontrada**.
- Compatibilidad **probada** con el parche `0.5.4f`. GGG no afirma esa
  correspondencia: el commit de origen lleva su propia etiqueta (`0.5.2`), por eso
  el artefacto se nombra por commit y no por parche.

No se usan RePoE, Path of Building, poe2db, scraping ni extracción del cliente, y
no se copian sprites ni recursos gráficos: solo id, nombre inglés, stats, tipo de
nodo, ascendencia y clases.

El registro se genera **offline** y se versiona; en runtime jamás se descarga nada:

```bash
npx tsx scripts/build-passive-registry.ts --download
```

El proceso verifica el SHA-256 de la revisión fijada, valida la entrada y la salida
con esquemas estrictos y falla de forma explícita si la estructura oficial cambia.
Un id que no esté en el registro se muestra siempre como «No verificado» junto a su
id crudo: el nombre nunca se deduce del texto del id.

> This product isn't affiliated with or endorsed by Grinding Gear Games in any way.

## Habla con tu mentor (Hito 6A)

La sección «5. Habla con tu mentor» permite preguntar en español y recibir una
respuesta **determinista**: sin LLM, sin red y sin texto inventado.

Preguntas que entiende hoy:

- «¿Qué mejoro ahora?», «¿Qué debería hacer primero?» → siguiente paso.
- «¿Por qué me recomiendas esto?», «¿Cuál es mi principal problema?» → explicación.

Cualquier otra pregunta se declara **no soportada**, sin proponer nada y con
ejemplos válidos: el mentor prefiere decir «esto todavía no lo sé» a improvisar.

La conversación reutiliza el motor y el Character Journal: si ya tienes una
acción activa, el mentor **recuerda ese paso** en lugar de crear otro y no
consulta precios. Cada respuesta muestra su única próxima acción, fuentes,
confianza y lo que falta por verificar.

**Limitación:** el hilo vive solo en memoria de la interfaz. No se persiste, se
pierde al recargar y se descarta cuando cambian los datos relevantes para no
mostrar respuestas obsoletas. Detalles en `docs/HITO_6A.md`.

## Estructura

- `shared/` — esquemas zod: dominio interno, contrato API y esquema oficial GGG Build Planner v1.
- `server/` — API Express: importadores (`.build` oficial, texto de objetos, PoB básico con límite de descompresión), diario persistente del mentor, adaptadores (GGG OAuth desactivado por flag, Mobalytics solo referencia), servicio poe.ninja con caché SQLite+ETag tolerante a corrupción y fixtures, motor determinista de recomendaciones, explicadores (determinista por defecto; LLM stub por flag), exportador `.build` oficial con informe.
- `src/` — frontend React + Tailwind + shadcn/ui (español, tema oscuro).
- `tests/` — vitest: unit, integration, e2e. `scripts/browser-smoke.mjs` — prueba de navegador real.
- `docs/PLAN.md` — plan y arquitectura. `docs/HITO_5A.md` — memoria persistente.
  `docs/HITO_5B.md` — memoria como contexto del motor. `HANDOFF.md` — informe
  para el propietario.

## Variables de entorno

Todas documentadas en `.env.example`. Destacadas:

- `POE_NINJA_OFFLINE=true` — nunca hace red; sirve fixtures (ideal para demos/tests).
- `POE_NINJA_USER_AGENT` — User-Agent descriptivo (exigido por poe.ninja).
- `GGG_OAUTH_ENABLED` / `EXPLAINER_LLM_ENABLED` — flags desactivadas por defecto.

## Reglas de datos

- Solo API económica pública documentada de poe.ninja (`/poe2/api/economy/...`), llamada desde el servidor, con caché/ETag y fallback. Sin scraping ni endpoints internos ni OAuth de GGG.
- Los valores desconocidos permanecen `null` («Desconocido»); nunca se convierten en cero ni generan afirmaciones falsas.
- Los objetos raros nunca se valoran con precios de únicos por coincidencia de base; no se inventan rangos de precio.
- Los presupuestos se comparan solo tras normalizar divine/exalted/chaos con las tasas reales de poe.ninja; sin tasas verificables no se afirma que algo «entra en el presupuesto».
