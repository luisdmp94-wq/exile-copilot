# Exile Copilot

Aplicación web para jugadores de **Path of Exile 2**. Su núcleo es un mentor
persistente que conoce el personaje, recuerda decisiones y mantiene una sola
próxima acción:

> «Importa tu build, indica tu presupuesto y recibe las próximas mejoras ordenadas por impacto, coste y riesgo.»

No es un chatbot genérico: construye un perfil estructurado del personaje,
consulta datos verificables (API económica pública documentada de poe.ninja),
devuelve acciones concretas y conserva el resultado de cada decisión en el
diario del personaje. Además, un **mentor contextual persistente** acompaña la
navegación: reacciona al objeto inspeccionado, al área abierta, al objetivo, al
presupuesto, al mercado y a las recomendaciones. La reacción inmediata es local
y determinista. En Crafting también sigue la pieza, el objetivo, la condición
de parada y la moneda que el jugador prepara. Su cabecera permanece visible y empieza plegada para no tapar
acciones; solo consulta al proveedor de IA cuando el jugador despliega el panel
y pulsa «Analizar este contexto». Mientras haya un paso activo no genera tareas
paralelas; si una mejora ya se intentó, exige reconciliar el resultado con el
perfil antes de repetirla.

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
- `npm run test:session` — prueba de navegador del ciclo «Probar y volver» (Hito 6C) en una base SQLite temporal; acepta `--dev`, `--all` y `--update-screenshots`.

## Cómo probar el flujo principal (sin credenciales)

1. Abre http://localhost:7100 y elige una intención: **«Mejorar mi personaje»**
   abre el importador, **«Empezar desde cero»** crea un perfil editable y
   **«Evaluar o craftear»** permite pegar un objeto y entrar directamente al
   banco de Crafting. **«Cargar ejemplo»** sigue disponible como recorrido demo.
2. Revisa/corrige campos en **Mi personaje** (atributos, resistencias, vida y defensas; «Desconocido» = sin dato, nunca 0) y pulsa **Guardar correcciones**. El personaje se recupera automáticamente al recargar la página (el id solo se guarda tras persistir de verdad en el servidor).
3. Al importar un **`.build` oficial** de GGG se añade como **Build objetivo** (plan de referencia), no como personaje. Un código de **Path of Building** sí rellena un personaje parcial.
4. En **Mercado actual** elige liga, presupuesto y objetivo; consulta precios (datos reales de poe.ninja con caché; tasas de conversión con origen y verificación visibles).
5. Pulsa **Generar recomendaciones** → 3 tarjetas con prioridad, acción, motivo, coste, impacto, riesgo, irreversibilidad, parche, fuentes, fecha y confianza. Si cambias cualquier dato, las tarjetas se invalidan.
6. Guarda una recomendación como **próximo paso**, o pulsa **Probar y volver**.
   El mentor te dice qué cambiar y qué observar. Cuando regreses del juego,
   pulsa **Volví de jugar** y elige el resultado: resuelto, mejoró, igual,
   empeoró o ocurrió algo diferente. El expediente conserva el resultado y,
   si el problema continúa, mantiene una sola próxima acción abierta.
7. Marca las recomendaciones aplicadas y pulsa **Descargar .build** → archivo
   **`.build` oficial** (GGG Build Planner v1) con las mejoras planificadas
   incrustadas, junto a un informe honesto de lo exportado y lo omitido.

## Crafting guiado con comparación antes/después

La pestaña Crafting funciona como un banco de decisión. Primero pregunta qué
quieres conseguir y separa, sin inventar valor, los mods con señal directa para
ese objetivo, los que no tienen una relación literal y los grados 1–2 que
merece la pena revisar antes de arriesgar. Después convierte la lectura de la pieza en una ruta visible: si
solo hay una moneda básica compatible permite prepararla directamente; si hay
varias, muestra la decisión sin fingir un ranking; y si el raro está lleno
lleva a las rutas de reemplazo de Essence o Alloy. Un objeto normal bien
identificado entra correctamente por Transmutación.

La intención se define una sola vez por pieza. El jugador elige con botones el
objetivo principal y puede añadir un matiz libre —por ejemplo, «más daño sin perder
velocidad ni +niveles»— y marca directamente sobre los afijos qué líneas deben
sobrevivir. Ese mismo plan acompaña a Monedas, Essences, Alloys y a la
comparación final; no hay tres formularios distintos ni se intenta interpretar
la palabra «sin» como si fuera evidencia estructurada.

En una ruta que solo añade, la lista de líneas intocables empieza plegada para
que la próxima acción siga visible. Se abre automáticamente cuando continuar
exige reemplazar un modificador, y también puede desplegarse manualmente en
cualquier momento.

Antes de preparar una moneda, el jugador declara también **cuándo debe parar**
mediante una a tres condiciones observables: aumentar el número de afijos con
etiquetas de la categoría elegida, hacer aparecer una línea exacta escrita por
él o alcanzar un número de afijos explícitos. Los umbrales siempre parten por
encima del snapshot actual, así que una condición no puede presentarse como
mejora si ya estaba cumplida. La interfaz ofrece como primera opción una señal
adicional de la categoría elegida y muestra el recuento actual y el objetivo en
lenguaje directo; el jugador debe aceptarla con un clic. Después del craft se muestra cada condición como
«cumplida», «no aparece» o «no comprobable». Si todas se cumplen, la acción
principal es parar y conservar, aunque todavía exista un hueco. La descripción
libre nunca se analiza como evidencia y las sesiones anteriores cargan sin
inventar condiciones.

La auditoría adversarial y sus límites están documentados en
[`docs/CRAFTING_ADVERSARIAL_AUDIT_2026-08-23.md`](docs/CRAFTING_ADVERSARIAL_AUDIT_2026-08-23.md).

**Crafting** es la tercera área principal del producto, separada de
«Expediente y mentor» y «Plan y mercado». Allí eliges una pieza real del
expediente y completas todo el ciclo sin saltar entre pestañas. El detalle del
objeto conserva sus datos y una entrada directa al banco; el preflight y la
sesión persistente existen una sola vez, dentro de Crafting.

Al seleccionar un objeto importado mediante texto avanzado, las acciones
compatibles aparecen primero y las no aplicables quedan en un bloque secundario.
Transmutación, Aumento, Regio y Exaltado se evalúan únicamente contra la
evidencia local documentada. El preflight obliga a registrar la variante
exacta (base, superior o perfecta cuando fue observada) y conserva el mínimo
mostrado en su tooltip sin tratarlo como probabilidad ni garantía. Una acción compatible permite abrir una
decisión guiada: antes de gastar exige definir el objetivo y una sola
confirmación compacta de que el snapshot sigue vigente, el resultado será
aleatorio y la moneda aún no se ha usado.

Las fichas de equipo, el detalle y el banco incluyen ilustraciones locales por
tipo de objeto y rareza. Son siluetas propias que siempre funcionan sin red; no
se presentan como el arte exacto del juego mientras el texto pegado no aporte un
id oficial verificable. La marca de la cabecera vuelve al expediente y el botón
Volver recupera el área anterior sin refrescar la página.

El primer flujo P1 cubre también **Essences**. Menor, Normal y Superior se
tratan como una mejora de mágico a raro; Perfecta y las obtenidas mediante
corrupción, como un reemplazo aleatorio de un modificador explícito en un raro.
El nombre y el efecto garantizado se copian siempre del tooltip real: la app no
los deduce ni incorpora una tabla incompleta. El contrato, las fuentes oficiales
y los límites están en
[`docs/CRAFTING_ESSENCES.md`](docs/CRAFTING_ESSENCES.md).

El segundo flujo guiado cubre **Alloys** sin inventar una tabla de compatibilidad.
GGG confirma que reemplazan un modificador existente por un modificador
fabricado garantizado y que un objeto solo puede tener uno. La pieza admitida y
la forma de elegir el reemplazo deben proceder del tooltip real que introduce
el jugador. Después del gasto, la comparación exige exactamente una retirada,
un añadido marcado como fabricado y no más de un fabricado total. El contrato y
sus límites están en [`docs/CRAFTING_ALLOYS.md`](docs/CRAFTING_ALLOYS.md).

El jugador puede marcar desde el plan los **modificadores que no acepta
perder**. Las herramientas muestran un resumen de esa selección sin duplicar el
formulario; una moneda que solo añade conserva la intención para la comparación,
pero no inventa un riesgo de retirada. El contrato distingue
entre retirada aleatoria, retirada elegida por el jugador y mecanismo todavía
desconocido: advierte cuando existe riesgo, bloquea cuando la pérdida es segura
y se niega a prometer protección si falta el dato decisivo. Tras pegar el
resultado, la comparación indica de forma separada si esos modificadores se
conservaron o se perdieron. Las selecciones antiguas se descartan cuando cambia
la pieza o su snapshot, para no aplicar una protección obsoleta a otro objeto.

Después de aplicar **una sola moneda** en el juego, pega el nuevo texto en el
caso abierto del banco de Crafting. La comparación ignora los ids aleatorios del importador y verifica
la misma base y el mismo nivel de objeto —si falta cualquiera de los dos niveles
el resultado queda inconcluso—, la transición de rareza, la conservación de los modificadores
anteriores —o exactamente una retirada cuando la acción lo declara— y la aparición
de exactamente un explícito nuevo. El jugador decide
si ese resultado le sirve; entonces se conserva la comparación en el diario y
se actualiza el objeto del expediente manteniendo su vínculo local.

Si el jugador empezó pegando una pieza suelta, el perfil mínimo se guarda al
preparar el craft y la sesión continúa en el mismo clic: no se abre el formulario
completo ni hay que repetir la acción. Durante la sesión, el planificador queda
oculto y la interfaz muestra únicamente tres etapas: antes de gastar, pegar el
resultado y decidir.

Antes de ofrecer una herramienta de reemplazo sobre una pieza llena, el banco
obliga a reconocer el riesgo para los afijos de grado alto que ya existen. Tras
pegar el resultado, el asesor formula una única decisión conservadora:
**continuar**, **parar y conservar** o **replantear la ruta**. Esa decisión usa
solo diferencias estructurales, requisitos y etiquetas explícitas verificadas;
no inventa DPS, precios, probabilidades ni calidad real de los afijos.

El bloque **Núcleo de afijos** cruza el objetivo con las etiquetas y grados que
aparecen literalmente en el texto avanzado. Resume cuántos afijos convergen en
la dirección elegida, qué etiquetas específicas se repiten y cuáles de grado
1–2 conviene revisar antes de reemplazar. El detalle afijo por afijo empieza
plegado para no saturar la pantalla. Una etiqueta genérica como «Ataque» no se
convierte por sí sola en daño directo: precisión y otras señales contextuales
permanecen separadas hasta que la build permita demostrar su utilidad.

La evidencia factual («qué cambió») y la valoración del jugador («me sirve»)
se guardan por separado. Si falla el guardado del objeto, la sesión permanece
abierta y permite reintentar; dos clics concurrentes no pueden cerrar o duplicar
el mismo resultado.

El objetivo incluye una categoría elegida por el jugador —daño, defensa,
atributos, velocidad, habilidades u otro— además de su descripción libre. Al
pegar el resultado, la app contrasta esa categoría únicamente con las etiquetas
literales que muestra el texto avanzado del juego. Puede señalar coincidencia
directa, ausencia de señal directa o datos insuficientes; nunca convierte esa
señal en «este objeto es bueno» ni sustituye la decisión final del jugador.

La comparación añade una **lectura del personaje** antes de preguntar si el
resultado sirve. Comprueba los requisitos declarados contra el nivel y los
atributos conocidos, detiene la recomendación si desapareció un modificador
protegido y relaciona señales de resistencias con huecos defensivos ya visibles
en el expediente. Si el craft cambió atributos, no reutiliza el total anterior
como si siguiera vigente: exige revisión. La salida es «candidato», «revisar» o
«detenerse», nunca una puntuación ficticia.

El nivel conserva su procedencia en todo el producto. Si todavía no fue
importado o escrito por el jugador, motor, mentor, diario y cabeceras muestran
«desconocido»: el mínimo técnico `1` nunca se usa para bloquear, calcular vida
esperada ni describir al personaje. Un nivel 1 declarado sí se conserva como
dato real.

Esto confirma cambios estructurales, requisitos y señales taxonómicas directas,
no la calidad del afijo. No estima pesos,
probabilidades, valor de mercado ni el resultado de monedas todavía no
documentadas.

El motor matemático avanzado ya puede calcular probabilidades ponderadas,
intentos y costes esperados, además de secuencias condicionales, pero permanece
cerrado por defecto: solo devuelve porcentajes si recibe un pool marcado y
validado como **verificado y completo**. Los pools parciales o ausentes producen
«probabilidad no disponible», nunca `0 %`. El contrato y sus límites están en
[`docs/CRAFTING_MATH_ENGINE.md`](docs/CRAFTING_MATH_ENGINE.md).

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

## Habla con tu mentor (Hitos 6A y 6E)

«Habla con tu mentor», dentro del área **Mentor**, permite preguntar en español.
Por defecto responde solo con reglas, sin llamadas externas ni coste. El Hito
6E añade un selector IA opcional: interpreta preguntas más naturales, pero solo
puede elegir una recomendación o un dato faltante que el motor ya haya
producido. La acción, las fuentes, la confianza y el texto final se reconstruyen
en el servidor a partir de esos datos canónicos.

Preguntas que entiende hoy:

- «¿Qué mejoro ahora?», «¿Qué debería hacer primero?» → siguiente paso.
- «¿Por qué me recomiendas esto?», «¿Cuál es mi principal problema?» → explicación.

Los botones que genera el propio mentor incluyen una intención estructurada y
se prueban contra este contrato. Una respuesta tardía puede conservarse en el
hilo, pero nunca sustituye el objeto, área o decisión que el jugador haya abierto
mientras esperaba. La etiqueta declara su origen real: «IA supervisada» con
modelo, «Respaldo del motor de reglas» o «Respuesta del motor»; nunca se atribuye
una respuesta a Groq solo por configuración.

Con IA desactivada, cualquier otra pregunta se declara **no soportada**. Con IA
activada puede relacionarla con hasta tres candidatos reales, pedir un dato
faltante real, explicar el caso o declarar que no existe una acción segura. Un
id inventado, una respuesta inválida, un rechazo, timeout o error de red activa
automáticamente el respaldo por reglas y queda visible en la evidencia.

La conversación reutiliza el motor y el Character Journal: si ya tienes una
acción activa, el mentor **recuerda ese paso** en lugar de crear otro y no
consulta precios. Cuando el motor sí necesita precios, el mentor usa el mismo
**servicio documentado de poe.ninja** que el resto de la aplicación (desde el
servidor, con caché y ETag). Por eso **las fechas y la evidencia pueden
cambiar**: la misma pregunta con los mismos datos puede citar precios o fechas
distintos más adelante, aunque la decisión siga saliendo del motor.

Cada respuesta se lee primero como te la contaría una persona — diagnóstico,
única próxima acción y confianza —; las fuentes, la fecha, la versión del motor
y lo que falta por verificar están completas dentro de «Ver evidencia y
limitaciones».

**Limitación:** el hilo vive solo en memoria de la interfaz. No se persiste, se
pierde al recargar y se descarta cuando cambian los datos relevantes para no
mostrar respuestas obsoletas. Groq es el proveedor predeterminado para la
prueba gratuita; su cuota no está garantizada para producción. OpenAI sigue
disponible como alternativa, con facturación API separada de ChatGPT. Ninguna
clave real se guarda en el repositorio. Detalles en `docs/HITO_6A.md` y
`docs/HITO_6E.md`.

## Estructura

- `shared/` — esquemas zod: dominio interno, contrato API y esquema oficial GGG Build Planner v1.
- `server/` — API Express: importadores (`.build` oficial, texto de objetos, PoB básico con límite de descompresión), diario persistente, selector IA supervisado opcional con respaldo determinista, adaptadores (GGG OAuth desactivado por flag, Mobalytics solo referencia), servicio poe.ninja con caché SQLite+ETag tolerante a corrupción y fixtures, motor determinista y exportador `.build` oficial con informe.
- `src/` — frontend React + Tailwind + shadcn/ui (español, tema oscuro).
- `tests/` — vitest: unit, integration, e2e. `scripts/browser-smoke.mjs` — prueba de navegador real.
- `docs/PLAN.md` — plan y arquitectura. `docs/HITO_5A.md` — memoria persistente.
  `docs/HITO_5B.md` — memoria como contexto del motor. `HANDOFF.md` — informe
  para el propietario.

## Variables de entorno

Todas documentadas en `.env.example`. Para desarrollo local, copia ese archivo
como `.env`; el backend lo carga automáticamente y Git lo ignora. Nunca uses el
prefijo `VITE_` para una clave privada. Destacadas:

- `POE_NINJA_OFFLINE=true` — nunca hace red; sirve fixtures (ideal para demos/tests).
- `POE_NINJA_USER_AGENT` — User-Agent descriptivo (exigido por poe.ninja).
- `GGG_OAUTH_ENABLED` / `EXPLAINER_LLM_ENABLED` — flags desactivadas por defecto.
- `MENTOR_AI_ENABLED=true` + `MENTOR_AI_PROVIDER=groq` + `GROQ_API_KEY` — activa
  el selector IA gratuito sujeto a la cuota de Groq. El valor por defecto de la
  flag es `false`, así que sin activarlo hay cero llamadas.
- `MENTOR_AI_PROVIDER=openai` + `OPENAI_API_KEY` — alternativa opcional de pago.
- `MENTOR_AI_MODEL`, `MENTOR_AI_REASONING_EFFORT`, `MENTOR_AI_TIMEOUT_MS` y
  `MENTOR_AI_MAX_OUTPUT_TOKENS` — límites explícitos documentados en `.env.example`.

## Reglas de datos

- Solo API económica pública documentada de poe.ninja (`/poe2/api/economy/...`), llamada desde el servidor, con caché/ETag y fallback. Sin scraping ni endpoints internos ni OAuth de GGG.
- Los valores desconocidos permanecen `null` («Desconocido»); nunca se convierten en cero ni generan afirmaciones falsas.
- Los objetos raros nunca se valoran con precios de únicos por coincidencia de base; no se inventan rangos de precio.
- Los presupuestos se comparan solo tras normalizar divine/exalted/chaos con las tasas reales de poe.ninja; sin tasas verificables no se afirma que algo «entra en el presupuesto».
