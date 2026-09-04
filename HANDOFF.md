# HANDOFF — Exile Copilot

> Informe para el propietario. Última actualización: sesión 123,
> 2026-09-02.
>
> **Estado actual:** `main` incorpora el rediseño visual, los Hitos 6C
> «Probar y volver» y 6D «Identidad persistente de la build», y el banco de
> crafting guiado hasta una condición observable de parada. Las secciones de sesiones anteriores son
> HISTORIA: los SHA y
> los «sin integrar» que aparecen en ellas describen el momento en que se
> escribieron, no el estado actual.

## Sesión 123 — un craft guardado ya no desaparece en Ayuda en vivo

- El recorrido como jugador real confirmó que «Guardar para seguir más tarde»
  sí persistía el craft, pero lo ocultaba al volver a Ayuda en vivo: solo podía
  encontrarse entrando manualmente en Taller avanzado.
- Ayuda en vivo mantiene ahora abierto el bloque mínimo de herramientas cuando
  existe un craft pausado. La tarjeta «Tienes un craft pausado» recibe el foco,
  permanece visible tras recargar y «Reanudar» recupera la misma pieza, moneda,
  objetivo, protecciones y comparación pendiente.
- Un expediente nacido al pegar una sola pieza deja de llamarse «Objeto suelto»
  y se presenta como «Expediente provisional». Los expedientes antiguos se
  normalizan al restaurar sin invalidar sus crafts: la huella conserva una
  representación compatible y evita el falso aviso «El personaje ya no es el
  mismo».
- El recorrido manual en `7202` reanudó «Núcleo de fénix» con Orbe exaltado,
  comprobó la ausencia del aviso falso y volvió a guardar la sesión dejando la
  tarjeta visible y enfocada. Música permanece visible en la cabecera.

Verificación final: flujo de equipo y Crafting **216/216**, Ayuda en vivo
**242/242**, suite completa **100 archivos y 906/906 pruebas**, TypeScript,
ESLint y build de cliente/servidor sin errores. No se hizo commit ni push.

## Sesión 122 — pausar y descartar un craft ya no parecen la misma acción

- El recorrido del Taller como jugador real llegó hasta el regreso desde PoE2 y
  encontró dos salidas demasiado parecidas: «Parar por ahora» conservaba el
  proyecto, mientras «Cerrar comprobación» lo descartaba sin confirmación.
- La pausa se llama ahora «Guardar para seguir más tarde». El descarte se
  identifica como «Descartar esta comprobación» y abre una confirmación que
  explica que el expediente no se actualizará con el resultado de PoE2.
- Cancelar el diálogo devuelve al mismo craft preparado, con su objeto, moneda,
  objetivo y protecciones intactos. La regresión reproduce esa cancelación antes
  de continuar con la comparación del snapshot.
- El recorrido manual en `7202` confirmó las dos acciones, abrió el aviso,
  canceló el descarte y comprobó que la sesión seguía disponible. Música
  permanece visible en la cabecera.

Verificación final: flujo de equipo y Crafting **208/208** en producción y
desarrollo, suite completa **100 archivos y 905/905 pruebas**, TypeScript,
ESLint y build de cliente/servidor sin errores, cero errores relevantes de
consola y cero peticiones externas. No se hizo commit ni push.

## Sesión 121 — lo no verificado ya no parece contenido abandonado

- La revisión del nivel avanzado encontró «Descripción del recurso pendiente»
  en el caso que enseña a comparar una Essence y un Alloy sin haber leído aún
  sus tooltips. La parada era correcta, pero el texto podía confundirse con una
  parte de la web que aún no habíamos terminado.
- Cada recurso sin evidencia muestra ahora «No verificado · léelo en PoE2 antes
  de gastar». Conserva la incertidumbre real, explica la siguiente acción y no
  inventa la descripción, compatibilidad, pool ni resultado del recurso.
- La barrera de navegador visita expresamente ese caso, exige dos avisos
  accionables y rechaza que reaparezca el texto ambiguo.
- La primera ejecución integral descubrió además una aserción antigua del nivel
  medio: buscaba una pista que ya había cambiado, aunque la interfaz sí la
  revelaba correctamente. Se actualizó la barrera para que un fallo vuelva a
  representar un problema real y no una frase obsoleta.
- El recorrido manual en `7202` llegó al caso 3, confirmó ambos avisos, la
  opción «Leer ambos recursos dentro del juego» y la ausencia del texto viejo.

Verificación final: Academia **154/154** en producción y desarrollo, pruebas
específicas **15/15**, suite completa **100 archivos y 905/905 pruebas**,
TypeScript, ESLint y build de cliente/servidor sin errores, cero errores
relevantes de consola y cero peticiones externas. `7202` conserva Música
visible. No se hizo commit ni push.

## Sesión 120 — la web deja claro quién ejecuta el craft

- Un recorrido manual completo en `7202`, actuando como un jugador, detectó
  una contradicción importante: la explicación decía que el paso ocurría en
  PoE2, pero el botón «Aceptar riesgo y usar orbe exaltado» podía hacer pensar
  que Exile Copilot aplicaba la moneda al pulsarlo.
- Toda acción de moneda comienza ahora con «Dentro de PoE2» y el botón solo
  confirma «Ya lo hice en PoE2». Su nombre accesible conserva la moneda o
  acción concreta para que lectores de pantalla no pierdan contexto.
- La regresión integral exige estos textos y rechaza expresamente que vuelva
  «Aceptar riesgo». Una primera pasada detectó 132 palabras visibles frente al
  límite de 130; se acortó «Por qué y qué puede ocurrir» a «Qué puede ocurrir»
  y la pantalla final quedó en 129 sin ocultar advertencias.
- La comprobación visual importó la fixture española «Núcleo de fénix», eligió
  crítico y llegó a Orbe exaltado: mostró «Dentro de PoE2», «Ya lo hice en
  PoE2», «No gastar todavía» y ningún texto que afirmase ejecutar el craft.

Verificación final: Coach **242/242** en producción y desarrollo, suite
completa **100 archivos y 905/905 pruebas**, TypeScript, ESLint y build de
cliente/servidor sin errores, cero errores relevantes de consola y cero
peticiones externas. `7202` está activo con el artefacto actualizado y Música
visible. No se hizo commit ni push.

## Sesión 119 — los proyectos largos dejan de ocultar intentos guardados

- El Taller ya persistía hasta doce intentos por personaje y pieza, pero la
  interfaz mostraba únicamente los cuatro últimos. Un proyecto largo conservaba
  datos que el jugador no tenía forma de volver a consultar.
- La memoria mantiene los cuatro intentos recientes a primera vista y ofrece
  un único control para desplegar los anteriores. Así mejora el seguimiento sin
  aumentar la densidad inicial que ya se había reducido en Crafting.
- Cada intento visible incluye ahora el nombre del resultado y su fecha,
  además de la rama, decisión, cambios y pérdida de una línea protegida que ya
  formaban parte del contrato persistente.
- El recorrido real del Taller crea seis intentos, exige que solo cuatro estén
  visibles, comprueba que los dos antiguos comienzan plegados y los abre para
  verificar resultado y fecha. También vuelve a salir y entrar, recarga el
  proyecto y vigila bucles de render, separación entre personajes, desborde
  móvil, consola y red externa.
- Una primera prueba unitaria colocó un módulo de navegador en el grafo del
  servidor y el build completo la rechazó. Se retiró esa dependencia cruzada;
  la regresión vive en el navegador, que es la capa que realmente demuestra el
  comportamiento. El build se repitió después y aprobó.

Verificación final: Taller **242/242** en producción y desarrollo, suite
completa **100 archivos y 905/905 pruebas**, TypeScript, ESLint y build de
cliente/servidor sin errores, cero errores de consola y cero peticiones
externas. `7202` carga el artefacto actualizado y conserva Música visible. No
se hizo commit ni push.

## Sesión 118 — el conocimiento de Crafting también admite ensayo sin escritura

- `record:crafting-knowledge` incorpora `--check --input <lote.json>`. El
  comando valida hasta cien snapshots contra el registro activo y devuelve los
  nombres de archivo que prepararía sin crear JSON ni modificar el manifiesto.
- El ensayo y el alta real comparten una sola preparación: esquema, ids,
  contaminación de PoE1, procedencia, registro ya activo, nombres seguros,
  destinos y manifiesto resultante. Tras aprobar el ensayo basta con retirar
  `--check`; no existe un segundo formato ni una validación más débil.
- La prueba inicial detectó que el refactor no devolvía la carpeta de destino
  que todavía necesitaba el alta normal. Se corrigió antes de cerrar la sesión
  y se repitieron tanto el camino sin escritura como el registro definitivo.
- La documentación de fuentes distingue expresamente el ensayo del alta y
  mantiene las restricciones existentes: una observación no se convierte en
  pool, `verified-complete` no se inventa y un lote inválido no deja altas
  parciales.

Verificación final: prueba específica **4/4**, suite completa **100 archivos y
905/905 pruebas**, TypeScript, ESLint y build de cliente/servidor sin errores.
No se registró ningún snapshot real, no se activó `0.5.5` y no se hizo commit
ni push.

## Sesión 117 — los lotes de tooltips pueden ensayarse antes de registrarlos

- La auditoría de `0.5.5` sigue fallando cerrada dos días antes de su salida:
  no acepta el anuncio como notas publicadas, no hereda evidencia de `0.5.4f`
  y mantiene `DEFAULT_PATCH` sin cambios.
- Antes de modificar el registrador se comprobó una sospecha de duplicación y
  se descartó: los ids repetidos dentro del mismo lote ya se validaban y ya
  tenían regresión. No se volvió a implementar ese arreglo.
- `record:item-sample` incorpora ahora `--check --batch <lote.json>`. Reproduce
  la misma validación previa al alta —esquema, ids, parser, confirmaciones,
  conflictos con el corpus y manifiesto resultante— y devuelve las muestras
  preparadas sin crear fixtures ni sustituir `corpus.json`.
- El registro real reutiliza esa misma preparación interna. No existe un
  validador paralelo que pueda aceptar un lote distinto del que se escribirá;
  después de un ensayo aprobado basta con retirar `--check`.
- El protocolo de captura explica el flujo de ensayo y conserva el límite de
  cien copias directas por operación, útil para 0.5.5 y para la recogida de
  evidencia de 1.0.

Verificación final: prueba específica **7/7**, suite completa **100 archivos y
904/904 pruebas**, TypeScript, ESLint y build de cliente/servidor sin errores.
El test nuevo demuestra que un lote válido devuelve sus lecturas esperadas y
deja tanto el manifiesto como el sistema de archivos intactos. No se activó
ningún parche, no se registraron muestras reales y no se hizo commit ni push.

## Sesión 116 — la barrera pública se ensaya sin inventar datos del proveedor

- `readiness:deployment` ejecutado sobre el entorno local enumeró seis datos
  operativos ausentes, no seis defectos del producto: modo público, producción,
  cookies HTTPS, proxy concreto, SQLite persistente e identidad de poe.ninja.
- Se repitió la auditoría con un candidato aislado y seguro: producción,
  `PUBLIC_DEPLOYMENT=true`, cookies protegidas, `TRUST_PROXY=loopback`, una ruta
  absoluta temporal, mercado explícitamente sin red y Mentor determinista. Las
  nueve comprobaciones aprobaron sin inventar dominio, correo ni secretos.
- Un primer intento escribió mal la ruta de Windows desde PowerShell; se
  contrastó `node:path` antes de editar y se confirmó que la aplicación ya
  reconoce correctamente rutas absolutas de Windows. No se introdujo un parche
  innecesario para ocultar un error del ensayo.
- El simulacro de restauración recuperó con integridad SQLite, expediente,
  diario y sesión del Mentor usando solo datos temporales. El simulacro de
  reinicio comprobó además que una configuración insegura falla antes de
  escuchar y que el servidor compilado recupera la misma sesión después del
  reinicio.
- `readiness:1.0` permanece deliberadamente bloqueado: el 2 de septiembre no
  puede fabricar metadatos, tooltips, pasivas, mercado ni recorridos fechados a
  partir del lanzamiento del 11 de diciembre. Tampoco cambia `DEFAULT_PATCH`,
  que continúa en `0.5.4f`.

Resultado verificable: **9/9 comprobaciones de configuración pública**,
simulacro de restauración y simulacro de reinicio aprobados. El código está
preparado para ensayar una publicación; siguen pendientes decisiones externas
reales —servicio de alojamiento, proxy observado, volumen y contacto— y la
evidencia exclusiva de PoE2 1.0 posterior a su lanzamiento. No se hizo commit
ni push.

## Sesión 115 — el smoke integral respeta las demos y Práctica pierde una duplicación

- El recorrido integral todavía exigía tres comportamientos anteriores a la
  frontera de procedencia de las sesiones 111–114: trataba Doom Song como una
  pieza real, esperaba una parada que abriera su expediente y permitía que una
  práctica llegara a una moneda. La aplicación ya protegía correctamente esos
  casos; era la regresión de navegador la que había quedado atrás.
- El recorrido general valida ahora el contrato actual: una necesidad sugerida
  por el expediente, un objetivo elegido por el jugador y un cambio a Gale
  Crown conservan siempre el modo de demostración, sin CTA de gasto, registro
  ni revisión de una posesión inexistente.
- Al recorrerlo apareció una duplicación visual real: Práctica mostraba dos
  avisos y dos botones «Volver a mi pieza». Se eliminó la franja redundante y se
  conserva un único resumen con la explicación, el regreso, otra práctica y la
  entrada para pegar una pieza propia.
- Las comprobaciones especializadas se actualizaron para observar ese único
  bloque sin rebajar ninguna barrera: siguen exigiendo que Práctica sobreviva a
  una recarga segura y que nunca aparezcan preflight, registro ni resultado
  real sobre datos didácticos.

Verificación final: TypeScript y build de cliente/servidor sin errores,
ESLint y `git diff --check` limpios en los archivos tocados, **100 archivos y
903/903 pruebas**. El recorrido integral aprobó completo en producción y
desarrollo; Ayuda en vivo/Taller aprobó **119/119** en ambos modos, con cero
errores de consola y cero peticiones externas. La revisión visual manual en
`7202` confirmó una sola explicación y un solo regreso en Práctica; `7201`
permanece cerrado. No se hizo commit ni push.

## Sesión 114 — Medio y Avanzado enseñan a decidir y parar sin revelar la respuesta

- El nivel Medio declara ahora una condición observable de parada en sus siete
  situaciones. Después de responder, el jugador recibe una idea clave, el
  límite que impide seguir gastando y tres acciones concretas que realiza
  dentro de PoE2; la web continúa enseñando y no simula el craft.
- Medio y Avanzado muestran únicamente las decisiones antes de responder. Las
  pistas aparecen después, junto a la corrección, para no regalar la solución
  ni saturar visualmente la primera lectura. Ambos conservan el objeto a la
  izquierda y las opciones a la derecha.
- Los validadores de contenido ya no aceptan una lección solo porque contenga
  la respuesta esperada. Exigen entre dos y cuatro opciones, ids únicos, una
  única decisión correcta, texto completo, objeto didáctico con procedencia y
  entre dos y cuatro pasos dentro del juego. Medio exige además su condición de
  parada; Avanzado, objetivo y salida.
- Los casos avanzados ya no contradicen la pieza visible: el reemplazo no
  afirma que una pieza esté llena cuando tiene huecos, y un caso con lectura
  incompleta oculta rareza y contadores todavía no confirmados en vez de
  revelar la respuesta desde la tarjeta.
- Una sesión antigua de Ayuda en vivo ya no puede restaurar `await-result`
  sobre Doom Song u otra pieza de demostración como si existiera en la cuenta.
  La procedencia se persiste y cualquier estado incompatible vuelve a una
  recomendación didáctica sin registro ni CTA de gasto real.
- El smoke de Academia usa el cargador acotado de configuración de Vite en
  desarrollo. Así conserva el aislamiento de puertos y SQLite sin solicitar
  lectura fuera del repositorio.
- El conocimiento verificable de Crafting deja de depender de una lista de
  archivos escrita en el servidor. Un manifiesto validado carga los snapshots
  activos y `record:crafting-knowledge` registra de forma atómica lotes de
  hasta cien: una entrada inválida, de PoE1, sin procedencia o repetida rechaza
  el lote completo sin dejar archivos parciales.
- El corpus de tooltips directos tampoco exige ya incorporarlos de uno en uno:
  `record:item-sample -- --batch` contrasta y registra hasta cien copias en una
  sola operación transaccional. Un tooltip contradictorio o un id repetido
  impide escribir cualquiera de las muestras del lote.
- «Analizar un objeto» conserva su interfaz durante la animación de salida. El
  panel ya no se transforma brevemente en el editor del personaje ni muestra
  la etiqueta irrelevante «Creado aquí» mientras Crafting aparece detrás.
- El Taller no presenta una ruta parcial como «Lista»: ahora la etiqueta es
  «Bloqueada» hasta tener una lectura completa. La publicación de contexto al
  Mentor es estable y ya no puede entrar en un ciclo de render al restaurar el
  contrato avanzado.

Verificación final: TypeScript, ESLint y build de producción sin errores,
**100 archivos y 902/902 pruebas**. La Academia aprobó **76/76** comprobaciones
en desarrollo y **76/76** sobre el artefacto final de producción; Ayuda en vivo
y Taller aprobaron **119/119** en producción. Los recorridos cubren Básico,
Medio, Avanzado, importación, recarga, teclado, 375/390 px, regreso a una pieza
real, contratos separados por personaje, cero errores de consola y cero
peticiones externas.
La auditoría manual independiente en 7202 confirmó además que Academia y Ayuda
en vivo conservan pieza, feedback y condición de parada al salir, volver y
recargar, sin romper Música, Mentor, Plan ni Expediente. No se hizo commit ni
push y 7202 no se reinició.

## Sesión 113 — Crafting conserva procedencia, resultados y contratos al recargar

- Una pieza real pegada después de usar o restaurar una demostración abandona
  completamente el perfil ficticio. El ejemplo y la práctica conservan ahora
  una procedencia persistente; recargar ya no puede convertirlos en una pieza
  sobre la que parezca legal gastar, ni mezclar su equipo con el del jugador.
- La comprobación avanzada guarda el texto completo copiado desde PoE2 por
  personaje y sesión. Al recargar recalcula el veredicto contra el snapshot
  autoritativo, conserva protecciones y diferencias, y no habilita el cierre si
  el resultado sigue siendo inconcluso.
- Un fallo al guardar el resultado ya no desaparece cuando el diario añade
  evidencia. La restauración solo se ejecuta cuando cambia realmente el
  personaje, la sesión, el parche o el contrato; la sesión permanece abierta y
  el jugador puede reintentar.
- El contrato del Taller dejó de recrear la lista de protecciones en cada
  render y su guardado es idempotente. Esto elimina el bucle
  `Maximum update depth exceeded` que aparecía al restaurar un proyecto con
  historial. La regresión reconstruye contrato e intento, recarga, espera cuatro
  segundos y exige cero errores nuevos.
- La ruta de una pieza llena se valida por el comportamiento observable:
  reconoce que debe reemplazar, explica que falta revisar el tooltip y no ofrece
  Essence o Alloy como rutas demostradas. Ya no depende de que exista una línea
  concreta para marcar como intocable ni de una puerta de parche obsoleta.
- El texto de fallo del proyecto describe únicamente lo observado —una línea
  protegida ausente, una ruta agotada o una base injustificada— sin atribuir la
  causa a una operación que la aplicación no presenció.

Verificación final: TypeScript, ESLint y build de producción sin errores,
**98 archivos y 889/889 pruebas**. Ayuda en vivo/Taller aprobó **119/119** y el
recorrido Expediente → Crafting → resultado aprobó **101/101**, tanto en
desarrollo como contra la compilación de producción; ambos terminaron con cero
errores de consola y cero peticiones externas. No se hizo commit ni push.

## Sesión 112 — las simulaciones ya no pueden autorizar un gasto real

- Se cerró la frontera de procedencia en todo Crafting. Las piezas del personaje
  de demostración y las piezas temporales de práctica son material didáctico:
  ninguna puede iniciar un intento, abrir el preflight de una moneda ni esperar
  que el jugador pegue un resultado que no existe en su cuenta.
- Ayuda en vivo distingue ahora «ejemplo» de «práctica». La práctica enseña la
  recomendación, explica que no se guarda y ofrece únicamente volver a la pieza,
  probar otra práctica o pegar una pieza propia. Una defensa interna bloquea
  además la transición a `await-result` aunque una futura regresión visual
  reintrodujera por error una CTA.
- El Mentor comparte la misma procedencia: una práctica se anuncia como
  simulación y dice expresamente que no se gaste moneda ni se pegue un resultado
  real. Ya no conserva un mensaje de gasto procedente del paso anterior.
- El Taller avanzado conserva el objetivo, la base, las protecciones, la parada
  y el mapa de rutas del personaje de ejemplo, pero lo presenta bajo
  «Proyecto de demostración: sin gasto real». Sus rutas dicen «Solo
  demostración», están deshabilitadas y no montan paneles de moneda, Essences o
  Alloys. La comprobación de procedencia también forma parte del estado interno
  de preparación, no solo del texto visible.
- La regresión de navegador parte de `Cargar ejemplo`, recorre Ayuda → práctica
  y el Taller completo hasta Ruta, y comprueba volver y recargar. Como el ejemplo
  es efímero, una recarga puede descartarlo y volver a una pantalla vacía; ese es
  un cierre seguro y nunca restaura una autorización imposible.

Verificación final: TypeScript y ESLint sin errores, build de cliente y servidor
correcto, **97 archivos y 883/883 pruebas**, y Ayuda en vivo/Taller **230/230**
en producción y desarrollo aislados. Una auditoría manual independiente en
`7202` repitió ambas rutas y confirmó que no aparece preflight, checkbox, CTA de
gasto ni espera de resultado. No se hizo commit ni push.

## Sesión 111 — cierre de persistencia y límites de Crafting

- Crafting conserva ahora el recorrido exacto al recargar: Ayuda en vivo,
  Academia o Taller. La Academia recuerda también el nivel Básico, Medio o
  Avanzado y vuelve a la situación y al feedback guardados. Tanto el recorrido
  como el nivel quedan aislados por personaje; los datos inválidos vuelven a un
  estado seguro.
- Los contratos del Coach quedan aislados por personaje y pieza. El formato v2
  migra una sola vez un contrato v1 compatible para no perder el progreso real,
  normaliza contadores antiguos y evita mensajes imposibles como «Paso 2 de
  1».
- Un contrato que ya consumió su límite permanece en HOLD después de recargar.
  Ya no ofrece «Ver otra vez la acción» ni una CTA de moneda: explica que el
  límite está agotado y ofrece únicamente cambiar de camino o pegar otra pieza.
- El Taller distingue un objetivo ausente de uno declarado pero todavía no
  verificable. Un texto como «Más daño de hielo» se conserva y se reconoce; si
  faltan señales o pool de modificadores, la app frena el gasto sin volver a
  pedir al jugador que diga qué quiere conseguir.
- El resultado final de Ayuda en vivo sí persiste actualmente, incluido el
  estado «NO CUADRA», el antes/después, el texto pegado y las vías de reparación.
  Esto sustituye expresamente la limitación histórica anotada en la sesión 110.
- La regresión automatizada fija los botones reales: «Cambiar objetivo» reinicia
  el contrato y «Pegar otra pieza» abre el importador. También comprueba que
  recargar conserva Academia/Medio y Academia/Avanzado sin tener que volver a
  seleccionarlos manualmente.
- El aislamiento del Coach ya no depende solo de una prueba interna. El smoke de
  navegador crea dos personajes con el mismo id de objeto, escribe un objetivo
  diferente en cada uno y alterna A → B con recargas. Comprueba por interfaz y
  almacenamiento que ninguno hereda el contrato, el intento pendiente, HOLD ni
  una CTA de gasto del otro.
- «Cargar ejemplo» ya no puede convertirse en una orden imposible dentro de
  PoE2. Cualquier pieza marcada por su procedencia como build de demostración se
  presenta como simulación, oculta la evaluación de moneda y nunca ofrece gasto
  ni solicita pegar un resultado real. El Mentor usa el mismo aviso y ofrece
  una pieza de práctica o pegar una pieza propia.

Verificación final: TypeScript, ESLint y `git diff --check` sin errores,
compilación de cliente y servidor correcta, **96 archivos y 880/880 pruebas**,
Ayuda en vivo/Taller **220/220** y Academia básica/media/avanzada **142/142** en
producción y desarrollo aislados. En `7202`, una auditoría manual independiente
confirmó los cinco repros, la migración v1, el bloqueo coherente de la demo y la
ausencia de regresiones visibles en Expediente, Plan, Mentor, Música y
navegación. No se hizo commit ni push.

## Sesión 110 — integración completa y reparación persistente desde Crafting

- Se inventariaron los cambios acumulados del árbol de trabajo y se revisaron
  como un único candidato: código de cliente y servidor, contratos compartidos,
  pruebas, documentación, contenedor, evidencias y corpus. La base temporal de
  la auditoría de jugador permanece en disco, pero `.tmp/` queda excluido de Git
  para que sus bases SQLite y registros no entren por accidente al producto.
- La auditoría paralela de jugador real encontró que «Pegar la pieza corregida»
  desde Ayuda en vivo sustituía el objeto solo en memoria. El importador abierto
  desde Crafting ahora guarda la adición o sustitución antes de cerrarse; si el
  guardado falla, conserva el panel y permite reintentar. El editor completo
  mantiene su guardado explícito y no cambia de contrato.
- Se reprodujo el recorrido con una copia incompleta de `Núcleo de fénix`, se
  reparó con el texto avanzado, se sustituyó y se recargó `7202`. La pieza, su
  estructura de tres prefijos y dos sufijos y el perfil activo sobrevivieron a
  la recarga. Expediente, Mentor, Plan, Crafting, Música y la navegación hacia
  el selector continuaron disponibles, sin errores de consola.
- El objetivo sencillo y un intento pendiente de Ayuda en vivo sobreviven ahora
  a una recarga. Se conservan la intención, la moneda recomendada, la foto
  anterior de la pieza, el mínimo de tirada, el número y límite de intentos y el
  texto parcial. Los perfiles antiguos con requisitos nulos se normalizan como
  ausencia de requisitos, sin inventar datos.
- El resultado final ya comparado (por ejemplo, «NO CUADRA») todavía no se guarda
  como historial cerrado y vuelve al estado normal tras recargar. Queda
  registrado como riesgo pendiente; no se presenta la memoria del intento como
  si ya existiese también un diario permanente de resultados.
- Las auditorías de `0.5.5` y `1.0` permanecen bloqueadas deliberadamente: sus
  fechas de lanzamiento aún no han llegado y no se activó ningún dato futuro ni
  se cambió `DEFAULT_PATCH`.

Verificación global posterior a la integración: `git diff --check`, ESLint y
TypeScript sin errores, build de cliente y servidor de producción correcto,
**93 archivos y 861/861 pruebas**. Validación manual no destructiva en `7202`
aprobada. No se hizo commit ni push.

## Sesión 109 — PoB2 conserva y aplica la versión real del árbol

- La exportación de PoB2 contiene dos versiones distintas: `targetVersion` es
  una compatibilidad interna de PoB y `treeVersion` identifica la familia del
  árbol pasivo. Se evitó interpretar `targetVersion="0_1"` como si fuese el
  parche 0.1 del juego.
- El importador conserva ambas como procedencia estructurada del expediente y
  compara únicamente `treeVersion` con la familia del parche activo. Un árbol
  `0_5` importado en `0.5.4f` continúa normalmente; un árbol `0_4` queda marcado
  como incompatible.
- La incompatibilidad ya no es un aviso efímero: persiste al guardar y recargar,
  deshabilita «Generar recomendaciones» y el servidor rechaza también la
  petición directa. La interfaz explica que hay que convertir la build en PoB2
  y volver a importarla.
- Se probó el recorrido real en producción con ambas instantáneas. La compatible
  se guardó sin falsa alarma; la antigua mostró el aviso, abrió la corrección y
  siguió bloqueada después de cerrar y recargar.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**92 archivos y 858/858 pruebas**. `7202` responde con la compilación nueva. No
se hizo commit ni push.

## Sesión 108 — 1.0 no puede aprobarse con fechas futuras

- La auditoría de lanzamiento usaba las fechas declaradas por los artefactos,
  pero no las comparaba con el día real de ejecución. Una edición accidental
  podía marcar el lanzamiento como publicado y fechar evidencias el 11 de
  diciembre antes de que llegara ese día.
- `readiness:1.0` recibe ahora la fecha real y rechaza metadatos, revisiones,
  corpus, recorridos, evidencias y pasivas posteriores a la auditoría. También
  muestra una comprobación independiente de que la ventana de lanzamiento ya
  está abierta.
- `1.0` ya tiene ficha anunciada y las cinco áreas explícitas en
  `review-required`. Esto prepara el trabajo de lanzamiento sin heredar reglas
  de `0.5.4f`, sin activar Crafting o Mentor y sin cambiar `DEFAULT_PATCH`.
- El anuncio y la fecha se contrastaron con la página oficial de Path of Exile 2
  en Steam. Al publicarse, la ficha exige una fuente nueva posterior al
  lanzamiento; cambiar únicamente el estado no basta.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**90 archivos y 852/852 pruebas**, auditoría actual correctamente bloqueada y
recorrido integral de producción aprobado. `7201` está cerrado y `7202` responde
con la compilación nueva. No se hizo commit ni push.

## Sesión 107 — alta de personaje guiada por el flujo oficial de PoB2

- Se recorrió la aplicación desde cero como un jugador real en la versión de
  producción de `7202`: alta, ayuda de Path of Building 2, personaje de ejemplo,
  diagnóstico, «Probar y volver» y regreso a la portada.
- La ayuda de importación ya no se limita a pedir un código. Reproduce los
  nombres y el orden actuales de Path of Building 2: `Import/Export Build`,
  `Authorize with Path of Exile`, `Passive Tree and Jewels`, `Items and Skills`,
  `Generate` y `Copy`.
- Se aclara el límite de privacidad: la autorización ocurre entre Path of
  Building 2 y Path of Exile; Exile Copilot solo recibe el código que el jugador
  decide pegar.
- La puerta de compatibilidad `0.5.5` sigue cerrada de forma deliberada hasta
  que exista evidencia posterior a su lanzamiento. La publicación externa
  también sigue bloqueada hasta disponer de dominio, proxy, almacenamiento
  persistente y contacto operativo reales; no se han inventado esos datos.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**851/851** pruebas y recorrido integral de producción aprobado por completo.
`7201` está cerrado y `7202` responde con la compilación nueva. No se hizo
commit ni push.

## Sesión 106 — recorrido real en un único servidor

- Se cerraron los procesos anteriores de `7201` y `7202`, se recompiló el
  producto y quedó únicamente la versión de producción en `7202`.
- «Abrir Mentor» ya no se limita a cambiar de área: controla el desplegable
  real, lo abre y coloca el foco en la pregunta. La regresión reproduce el gesto
  desde la cabecera.
- «Probar y volver» sobre un ejemplo sin guardar dejó de abrir el editor entero.
  Muestra una confirmación breve, guarda el personaje y continúa automáticamente
  la comprobación elegida.
- La recomendación de resistencias distingue el objetivo de los valores
  actuales: ya no dice ambiguamente «Sube frío 61%», sino que explica que frío
  61% y rayo 40% son el punto de partida hacia el objetivo provisional.
- El Mentor conserva el hilo de un ejemplo en la pestaña sin intentar guardarlo
  en el servidor ni mostrar un aviso de fallo engañoso. Mercado tampoco intenta
  valorar objetos raros por nombre; solo ofrece reutilizar únicos equipados.
- La ayuda de PoB2 exige comprobar equipo, nivel y habilidades antes de exportar,
  para no presentar un plan vacío como captura del personaje.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**851/851** pruebas y recorrido integral de producción aprobado, incluido el
acceso de cabecera al Mentor y la confirmación breve de memoria. `7201` está
cerrado y `7202` responde. No se hizo commit ni push.

## Sesión 105 — un `.build` parcial ya no cierra el alta como si hubiera terminado

- El recorrido real reproducía el fallo visible: un archivo oficial `.build`
  aportaba nombre, ascendencia, habilidades y pasivas, se guardaba como borrador
  y cerraba el lateral. El jugador aterrizaba en un expediente con clase y nivel
  desconocidos y diez huecos vacíos, sin entender que había importado un plan y
  no una captura completa de Path of Building 2.
- La importación distingue ahora `profile-ready` de `profile-incomplete`. Solo
  un personaje preparado cierra el alta; un borrador mantiene el lateral abierto
  y lo convierte en el editor completo, enfocado en Clase, con los avisos y los
  campos que faltan delante del jugador.
- El selector de personaje deja de ofrecer `.build` y JSON como si fueran una
  captura equivalente. Pide un texto/código de Path of Building 2 y reserva los
  `.build` para Plan y mercado; si se pega uno manualmente todavía conserva la
  parte aprovechable sin fingir que el alta terminó.
- La regresión de navegador exige que el diálogo siga abierto, muestre la causa
  y permita completar clase y nivel antes de mostrar el expediente parcial.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**851/851** pruebas y recorrido integral de producción aprobado sin errores de
navegador ni API. No se hizo commit ni push.

## Sesión 104 — PoB2 ya no abandona al jugador en GitHub

- El enlace de ayuda era oficial, pero abría la lista de Releases de GitHub y
  obligaba a una persona no técnica a descubrir qué archivo debía descargar.
- La acción principal apunta ahora al instalador oficial más reciente para
  Windows mediante la URL estable `releases/latest/download`. El texto declara
  que la descarga es directa y que no hace falta buscar el archivo en GitHub.
- La lista de Releases se conserva como acción secundaria, claramente
  etiquetada para quien necesite la versión portátil u otras descargas.
- La regresión de navegador exige ambos destinos y el texto explicativo; una
  futura simplificación no puede devolver silenciosamente el problema.

Verificación: TypeScript y ESLint sin errores, build de producción correcto y
recorrido integral de producción aprobado sin errores de navegador ni API. No
se hizo commit ni push.

## Sesión 103 — un expediente abierto directamente ya tiene salida

- Un recorrido con un personaje parcial reprodujo el bloqueo visible: al abrir
  directamente Expediente no existía historial de áreas y la flecha de vuelta
  desaparecía, aunque el personaje ya estuviera guardado.
- La cabecera muestra ahora «Volver a personajes» siempre que haya un perfil
  activo y no exista un área anterior. La acción aparta el expediente, vuelve a
  la bienvenida y ofrece recuperarlo; no lo elimina del servidor ni mezcla su
  memoria con otro personaje.
- Si sí existe historial entre Expediente, Plan y Crafting, la misma flecha
  mantiene su comportamiento anterior «Volver al área anterior». También se
  conserva en la vista estrecha del navegador integrado.
- La regresión de producción recarga el expediente para vaciar el historial,
  exige la salida visible, vuelve a la selección, comprueba el nombre recuperable
  y restaura el mismo perfil.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**90 archivos y 851/851 pruebas**, prueba visible sobre la página local y
recorrido integral de producción aprobado sin errores de navegador ni API. No
se hizo commit ni push.

## Sesión 102 — guardar un consejo ya no se contradice a sí mismo

- El recorrido aislado continuó desde la primera recomendación parcial y
  encontró un fallo de estado: «Guardar como próximo paso» confirmaba el
  guardado, pero a la vez mostraba «Tus datos cambiaron» y pedía volver a
  generar las recomendaciones.
- La revisión del diario cambia legítimamente cuando el consejo pasa a ser el
  paso activo. La interfaz distingue ahora esa transición de una invalidación
  real: retira el lote anterior en silencio y conserva únicamente la
  confirmación «Has guardado… / Próxima acción guardada».
- Si el diario apunta a otra recomendación, o cambian personaje, objetivo,
  presupuesto o memoria externa, la invalidación sigue activa. La corrección
  no suaviza esa barrera de seguridad.
- La regresión pura cubre coincidencia, recomendación distinta y diario vacío;
  el recorrido de producción comprueba además que el guardado no añade ninguno
  de los dos avisos falsos.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**90 archivos y 851/851 pruebas**, repetición manual visible del guardado y
recorrido integral de producción aprobado sin errores de navegador ni API. No
se hizo commit ni push.

## Sesión 101 — el Mentor ya distingue una captura parcial de un análisis amplio

- El recorrido visible con una importación PoB2 realista descubrió que dos
  piezas reconstruidas bastaban para mostrar «Listo para analizar». El motor
  sí podía orientar con habilidades y estadísticas observadas, pero la interfaz
  exageraba cuánto equipo había visto.
- La preparación del expediente declara ahora tres alcances: bloqueado,
  parcial y amplio. Clase o nivel desconocidos y cero equipo siguen bloqueando;
  de una a cinco piezas permiten orientación parcial; seis o más permiten
  presentar un análisis amplio. Seis es un umbral editorial de seguridad, no
  una regla inventada de Path of Exile 2.
- Antes de generar, el caso explica cuántas piezas observa y que no tratará los
  huecos ausentes como analizados. Después conserva «Diagnóstico parcial» y el
  recuento junto a la confianza de la recomendación.
- La regresión de navegador importa el fixture PoB2 de dos piezas y exige que
  el botón pueda avanzar sin que reaparezca el falso «Listo para analizar».

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**89 archivos y 848/848 pruebas**, recorrido manual visible hasta la primera
recomendación y recorrido integral de producción aprobado sin errores de
navegador ni API. No se hizo commit ni push.

## Sesión 99 — importar ya enseña de dónde sale el código PoB2

- El recorrido visible de un usuario nuevo llegó al alta y encontró una barrera
  anterior al parser: la pantalla exigía un «código de Path of Building 2» sin
  explicar cómo obtenerlo. Para quien no conociera PoB2, la acción principal
  quedaba bloqueada aunque la importación funcionase correctamente.
- El importador muestra ahora una ayuda plegada «¿Dónde consigo el código de
  PoB2?». Al abrirla explica el recorrido observado «Import/Export Build →
  Generate → copiar el código completo» y enlaza las publicaciones del proyecto
  oficial de Path of Building 2.
- La ayuda empieza cerrada para conservar una incorporación compacta. No cambia
  el tratamiento de `.build`: en Personaje sigue creando un borrador parcial y
  en Plan continúa siendo un objetivo, nunca una captura completa disfrazada.
- La regresión de navegador exige que el bloque exista y empiece plegado, que
  los pasos sean visibles al abrirlo y que el enlace apunte al proyecto oficial.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**89 archivos y 847/847 pruebas**, y recorrido principal de producción completo
sin errores de navegador ni API.

## Sesión 98 — una carencia del personaje ya no autoriza gastar a ciegas

- Un recorrido visible como jugador real descubrió una contradicción crítica:
  «No lo sé» detectaba resistencias por debajo del 75%, advertía que Doom Song
  no demostraba encajar con esa necesidad y, aun así, terminaba ofreciendo un
  Orbe exaltado sobre el arma.
- La evaluación distingue ahora un objetivo elegido por el jugador de uno
  sugerido por el expediente o el plan. El segundo nunca puede convertirse en
  un intento aleatorio si la pieza no contiene una señal directa del objetivo;
  bloquea la moneda y ofrece cambiar de pieza sin gastar.
- El límite no inventa reglas de ranura, pools ni probabilidades de PoE2. Si el
  jugador declara expresamente su objetivo, el intento controlado existente
  conserva su advertencia; si la aplicación lo deduce, asume una obligación de
  seguridad mayor.
- La regresión de navegador reproduce el camino completo «No lo sé → Buscar
  resistencias en esta pieza» y exige una parada sin el botón de aceptar moneda.
  La comprobación se repitió además en la página visible de producción.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**89 archivos y 847/847 pruebas**, y recorrido principal de producción
aprobado sin errores de navegador ni API.

## Sesión 97 — el Mentor ya recupera su conversación real

- La conversación dejó de depender únicamente de `sessionStorage`: el servidor
  conserva hasta ocho turnos completos por sesión anónima y personaje.
- SQLite guarda la conversación estructurada y una huella SHA-256 de los inputs,
  no una segunda copia del perfil. Cambiar personaje, objetivo, presupuesto,
  liga, parche o diario invalida y elimina el hilo antiguo.
- Las rutas de guardar, recuperar y borrar comprueban antes la propiedad del
  personaje. Otra sesión recibe el mismo 404 que ante un id inexistente y el
  borrado total del visitante elimina también sus hilos.
- La interfaz mantiene `sessionStorage` como recuperación rápida, restaura desde
  el servidor sin pisar una pregunta en curso y no oculta una respuesta si falla
  únicamente el guardado remoto.
- El simulacro del servidor compilado guarda ahora una respuesta real del
  Mentor, reinicia el proceso sobre la misma SQLite y exige recuperarla con la
  misma cookie protegida.

Verificación: TypeScript y ESLint sin errores, suite completa **844/844**,
recorrido real del Mentor **51/51** —incluida una pestaña nueva sin
`sessionStorage`— y simulacro del servidor compilado aprobado tras reiniciar.

## Sesión 96 — el reinicio real ya forma parte de la barrera

- Se añadió `scripts/production-restart-drill.mjs`. No importa la API dentro del
  proceso de pruebas: lanza `scripts/start-production.mjs` y usa el frontend y
  servidor ya compilados, igual que el contenedor público.
- Su primer arranque omite un proxy seguro y debe terminar con la barrera de
  configuración antes de aceptar tráfico. El segundo confirma que HTTP directo
  recibe 426 sin cookie y que una petición mediante el proxy simulado obtiene la
  cookie `__Host-` con `Secure`, `HttpOnly`, `SameSite=Strict` y `Path=/`.
- El recorrido guarda un expediente y una entrada del diario en una SQLite
  temporal, detiene el proceso, lo vuelve a arrancar con el mismo archivo y
  recupera ambos usando la misma cookie. También comprueba que el servidor no
  reemplaza una sesión válida al volver.
- `verify:release` ejecuta ahora `drill:restart` después del simulacro de copia.
  El primero demuestra el ciclo del artefacto desplegable; el segundo continúa
  demostrando integridad y restauración de una copia separada.

Verificación: simulacro de reinicio aprobado, ESLint sin errores y suite
completa **841/841**. El proceso y la base usados fueron temporales; no se tocó
la SQLite real.

## Sesión 95 — alojamiento recomendado sin fingir un despliegue

- Se compararon Render, Railway y Fly.io usando únicamente documentación
  oficial. Render queda recomendado para el primer ensayo público porque su
  servicio de pago con un único disco coincide con la arquitectura SQLite de
  una instancia y mantiene sondeos de salud continuos sobre el servicio vivo.
- Railway conserva buenas copias de volúmenes, pero hoy fuerza una decisión
  incómoda: documenta que el volumen se monta como `root` y propone UID 0 para
  imágenes sin privilegios. Además, su sondeo no vigila el endpoint después de
  activar el despliegue. Fly.io cubre volumen y secretos, pero añade operación y
  no reinicia una máquina solo porque falle el sondeo.
- `docs/HOSTING-DECISION.md` registra la elección, las fuentes, los límites y
  ocho comprobaciones que debe superar el ensayo. No se creó `render.yaml`, no
  se contrató un servicio y no se inventó `TRUST_PROXY`: primero se observarán
  permisos y red reales.
- La primera publicación deberá aceptar un breve corte al desplegar, porque
  Render detiene la única instancia antes de intercambiar un disco persistente.
  Sus capturas diarias no sustituyen nuestra copia de SQLite detenida ni el
  simulacro de restauración.

Pendiente: el propietario debe aprobar el coste y aportar un contacto real para
poe.ninja; después se ejecuta el ensayo manual descrito en la decisión. Solo si
pasa se codifica el proveedor y se conecta dominio o jugadores.

## Sesión 94 — el servidor público ya tiene un artefacto portable

- Se añadió un `Dockerfile` de dos etapas sobre Node.js 24. La etapa final solo
  conserva dependencias de ejecución, frontend, servidor compilado y el
  arranque de producción; no necesita TypeScript ni Vite delante de usuarios.
- La imagen se ejecuta como `node`, usa `/data/exile-copilot.db`, declara el
  volumen y comprueba `/api/ready`. Activa modo público y cookies seguras, pero
  no inventa `TRUST_PROXY` ni el contacto de poe.ninja: sin los valores exactos
  del proveedor, la barrera existente detiene el arranque.
- `.dockerignore` excluye `.env`, claves indirectas, bases, WAL/SHM, logs,
  dependencias y builds locales. `.env.example` permanece como documentación,
  nunca como configuración operativa.
- Una regresión estática comprueba Node 24, las dos etapas, el usuario sin
  privilegios, el volumen, el sondeo, el fallo cerrado y la ausencia de claves.
  `docs/DEPLOYMENT.md` explica el límite: el puerto solo se entrega al proxy
  HTTPS y el volumen/secretos se configuran en el alojamiento elegido.

Pendiente: ejecutar una construcción real de la imagen en una máquina con
Docker y seleccionar el proveedor, porque este equipo no expone actualmente el
ejecutable Docker. La prueba local sigue validando el contrato y el build de la
aplicación, pero no sustituye esa construcción.

Verificación: contrato de contenedor **4/4**, ESLint sin errores, build de
producción correcto y suite completa **841/841**.

## Sesión 93 — versión candidata verde y trabajo repetido bajo control

- El importador ya no convierte texto arbitrario en un objeto fantasma. Al
  pegar una segunda pieza sobre un hueco ocupado, el expediente conserva ambas
  lecturas y obliga a elegir entre sustituir la pieza, guardarla como extra o
  cancelar. Una tercera sortija ofrece los dos huecos como candidatos; no hay
  sobrescrituras silenciosas.
- La barrera completa encontró dos comprobaciones antiguas, no dos funciones
  rotas: Equipo y Diario seguían buscando todas las acciones visibles a la vez,
  aunque las alternativas ahora empiezan resumidas para reducir densidad. Las
  pruebas abren cada alternativa y validan el vínculo al objeto y «Guardar como
  próximo paso» de la misma forma que una persona recorre la interfaz.
- La versión candidata local pasa ESLint, build de producción, **87 archivos y
  837 pruebas**, restauración aislada, flujo principal y todos los recorridos
  especializados en desarrollo y producción: Equipo **196/196**, Mentor
  **100/100**, Academia **142/142**, Taller **188/188**, Diario **58/58**,
  Sesiones **60/60** y Memoria **20/20**.
- La auditoría de publicación falla cerrada por seis decisiones externas y
  concretas: modo público, producción, cookies HTTPS, proxy acotado, SQLite
  persistente y contacto real de poe.ninja. El código no debe volver a retocar
  áreas verdes para intentar resolver esas variables.
- `docs/ROADMAP.md` fija una semana de estabilización y una regla de congelación:
  solo se reabre un flujo verde por evidencia de jugador, cambio de parche o
  regresión reproducible. El siguiente trabajo es alojamiento y revisión real
  de 0.5.5, no otra pasada general de diseño.

Verificación: ESLint sin errores, build de producción correcto, **837/837**
pruebas, restauración íntegra y todos los recorridos de navegador aprobados en
desarrollo y producción.

## Sesión 92 — una muestra 1.0 ya no entra al corpus por autodeclaración

- La barrera exigía copias directas de objetos en español e inglés, pero añadir
  una requería guardar el texto y editar manualmente todo el snapshot esperado
  en `corpus.json`. Autogenerarlo sin contraste habría creado una prueba
  circular: el parser se habría declarado correcto a sí mismo.
- `npm run record:item-sample -- --input <muestra.json> --text <tooltip.txt>`
  exige ahora una confirmación independiente de nombre, base, ranura, rareza,
  nivel, calidad, prefijos, sufijos, estado del diagnóstico y mecánicas
  especiales visibles. Si cualquiera contradice la lectura o el parser emite
  un aviso, no se escribe el fixture ni el manifiesto.
- Tras el contraste, el comando preserva el tooltip normalizado bajo
  `server/fixtures/itemText/direct/<parche>/`, deriva el resto del snapshot y
  actualiza el corpus mediante un manifiesto temporal validado. Rechaza ids,
  parches e idiomas no autorizados, procedencia insuficiente, textos demasiado
  cortos, duplicados y sobrescrituras.
- La auditoría del corpus acepta ahora también un manifiesto vacío válido para
  poder informar «faltan muestras» sin confundirlo con JSON corrupto. Sigue
  reproduciendo cada entrada desde sus bytes; readiness solo cuenta copias
  `in-game-clipboard` del parche exacto, idioma soportado y fecha posterior al
  lanzamiento.
- `docs/ITEM-TEXT-CORPUS-PROTOCOL.md`, el README del corpus y la guía 1.0
  describen el único alta autorizada. Una lectura que falla se conserva como
  informe para corregir el parser, no se añade rebajando expectativas.
- La comprobación del servidor compilado descubrió además una regresión previa:
  `soul-branch-advanced.es.txt` vive en `docs/evidence`, fuera de
  `server/fixtures`, y no se copiaba al build. Desarrollo reproducía 4/4 casos,
  pero producción solo 3/4. `copy-server-assets.mjs` lee ahora también el
  manifiesto del corpus, valida todas las rutas antes de copiar y conserva cada
  fixture externo en la misma posición relativa dentro de `dist-server`.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**820/820** pruebas totales y **25/25** pruebas dirigidas de corpus y readiness.
La ayuda del comando se ejecutó realmente; las pruebas cubren reproducción,
contradicciones, rollback, duplicados, idioma, procedencia, fixtures externos y
rutas inseguras. El corpus compilado se ejecutó y reprodujo **4/4** muestras.

## Sesión 91 — cada evidencia técnica nueva conserva también su fuente

- Las cinco áreas de compatibilidad ya exigían ids y SHA-256, pero registrar una
  evidencia de 1.0 todavía requería editar área, parche, ruta y huella a mano.
  Además, el catálogo fijaba un solo archivo: una nota podía quedar asociada a
  la fuente equivocada sin que la integridad de bytes lo detectase.
- `npm run record:evidence -- --input <evidencia.json>` recibe ahora únicamente
  metadatos revisables y la ruta de una fuente ya preservada dentro del
  repositorio. Deriva un recibo `EC-RELEASE-EVIDENCE-1`, la huella de la fuente,
  la huella del recibo y la entrada completa del catálogo. No acepta hashes ni
  rutas de salida del operador.
- La auditoría comprueba el contenido del recibo contra id, área, parche, fecha,
  método, nota y fuente del catálogo, y después vuelve a comprobar los bytes de
  la fuente. Recalcular el hash de un recibo cuyo área fue manipulada ya no lo
  valida. Duplicados, fuentes exteriores, directorios y sobrescrituras se
  rechazan antes de completar el alta.
- El empaquetado de producción copia recibo y fuente juntos. Esa ruta se probó
  de forma independiente y valida todos los destinos antes de copiar el
  primero, evitando artefactos parciales ante un traversal. Las entradas
  históricas sin recibo continúan auditándose con su contrato anterior; toda
  evidencia generada por el comando nuevo utiliza el contrato doble.
- `docs/RELEASE-EVIDENCE-PROTOCOL.md` documenta el único flujo autorizado y
  recuerda que la automatización demuestra integridad y asociación, pero la
  revisión humana sigue decidiendo si la fuente demuestra realmente el parche.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**815/815** pruebas totales y **27/27** pruebas dirigidas de evidencia,
compatibilidad y readiness. La ayuda del comando se ejecutó realmente y el
catálogo histórico permanece íntegro.

## Sesión 90 — registrar una prueba humana ya no requiere editar JSON

- El formato semántico de la sesión anterior era comprobable, pero su alta aún
  exigía construir el Markdown, calcular SHA-256 y editar
  `playerWalkthroughs.json` a mano. Ese procedimiento podía introducir errores
  o sobrescribir evidencia válida precisamente en la última barrera de 1.0.
- `npm run record:walkthrough -- --input <informe.json>` valida ahora el ID, el
  parche, idioma, fecha, resultado, cinco puntos, bloqueos y un mínimo de tres
  observaciones. Después deriva el informe versionado, calcula la huella y
  actualiza el manifiesto; el operador no suministra rutas ni hashes.
- El registro rechaza aprobaciones con puntos pendientes o bloqueos, sesiones
  bloqueadas sin una causa, ids y artefactos repetidos y segmentos de ruta
  manipulados. Escribe mediante un manifiesto temporal validado y, si falla,
  retira el artefacto nuevo para no dejar un alta parcial. Nunca sobrescribe un
  informe existente.
- El protocolo y las barreras de lanzamiento usan ya este único procedimiento.
  El manifiesto real sigue vacío porque las dos observaciones de PoE2 1.0 no se
  pueden realizar antes de su publicación.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**810/810** pruebas totales, **23/23** pruebas dirigidas y ejecución real de la
ayuda del comando. Las pruebas cubren registro válido, auditoría posterior,
rollback de una entrada inválida, duplicados y traversal de ruta.

## Sesión 89 — una huella válida ya no puede ocultar un informe vacío

- La primera barrera de recorridos comprobaba la existencia y SHA-256 del
  archivo, pero todavía era posible registrar como aprobado un texto vacío o
  uno que no demostrase lo declarado en el manifiesto. La integridad de bytes
  no demostraba la calidad ni la coherencia de la evidencia humana.
- Los informes usan ahora el formato determinista
  `EC-PLAYER-WALKTHROUGH-1`, con cabecera, rol, parche, idioma, fecha,
  resultado, cinco puntos identificables, bloqueos y observaciones. El auditor
  vuelve a leer ese contenido y lo contrasta campo a campo con el manifiesto.
- Un archivo vacío con su SHA-256 correcta, un parche cambiado, una casilla que
  contradiga el manifiesto, bloqueos distintos o menos de tres observaciones
  concretas dejan `artifactVerified` en falso. La plantilla pública y las
  barreras de calidad explican el mismo contrato para que el registro futuro no
  dependa de memoria informal.
- El manifiesto sigue vacío intencionadamente: los recorridos de jugador nuevo
  y experto solo podrán registrarse cuando se observen de verdad con PoE2 1.0
  desde el 11 de diciembre de 2026.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**807/807** pruebas totales y **20/20** pruebas dirigidas de readiness y
recorridos. `readiness:1.0` continúa bloqueada y enumera las evidencias futuras
sin habilitar datos de 0.5.4f como si fueran 1.0.

## Sesión 88 — 1.0 ya no puede publicarse sin probar personas reales

- La hoja de ruta pedía recorridos manuales de jugador nuevo y experto, pero la
  barrera de lanzamiento no los comprobaba. Era posible completar metadatos,
  corpus y evidencias técnicas y olvidar la validación humana de comprensión.
- `playerWalkthroughs.json` registra ahora cada recorrido con rol, parche,
  idioma, fecha, cinco hitos observables, bloqueos, resultado y un artefacto
  local fijado mediante SHA-256. El auditor rechaza rutas exteriores, huellas
  alteradas, ids duplicados y un mismo informe reutilizado para ambos roles.
- `readiness:1.0` exige recorridos independientes, posteriores al lanzamiento,
  completos y sin bloqueos para jugador nuevo y jugador experto. Un recorrido
  fallido se conserva como evidencia útil, pero no autoriza la publicación.
- `docs/PLAYER-WALKTHROUGH-PROTOCOL.md` define la tarea común, las reglas de
  privacidad y la plantilla que se utilizará junto al cliente real. El
  manifiesto permanece vacío de forma intencionada: no se han inventado pruebas
  que todavía no han ocurrido.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**805/805** pruebas y **18/18** pruebas dirigidas de readiness y recorridos. La
auditoría actual permanece bloqueada y enumera expresamente los dos roles que
faltan, además de las evidencias 1.0 aún futuras.

## Sesión 87 — producción conserva las evidencias que habilitan el lector

- El recorrido de producción se detenía al pegar un objeto aunque desarrollo
  funcionase: el servidor compilado auditaba desde `dist-server`, pero el build
  solo copiaba `server/data` y `server/fixtures`. Las evidencias versionadas
  ubicadas en `docs/` no existían dentro del artefacto y la barrera de seguridad
  degradaba correctamente `item-import` a `review-required`.
- `copy-server-assets.mjs` lee ahora el catálogo de evidencias y copia cada
  artefacto declarado conservando su ruta relativa dentro de `dist-server`.
  También rechaza cualquier destino que intente salir del artefacto autorizado.
  Así desarrollo y producción auditan exactamente los mismos bytes, sin relajar
  la comprobación de huellas ni abrir pools, pesos o probabilidades ausentes.
- El simulacro de restauración se adaptó a la política vigente de sesiones:
  `/health` permanece totalmente anónimo y la cookie solo nace en una ruta
  funcional que realmente necesita identidad de visitante.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**801/801** pruebas, simulacro de restauración correcto y recorrido completo de
navegador en producción. El caso que fallaba —objeto suelto → guía de Crafting—
queda comprobado en el navegador sin errores de consola ni de API.

## Sesión 86 — el Mentor respeta la compatibilidad por área

- El endpoint del Mentor ya no comprueba únicamente que el parche tenga alguna
  cobertura global. Antes de responder identifica si la consulta pide Crafting
  básico o avanzado y aplica la cobertura concreta de esa área.
- Una pregunta libre sobre Essences o Alloys y un estado avanzado enviado por
  un cliente antiguo reciben una explicación canónica de revisión pendiente.
  No se ejecutan el motor de recomendaciones ni el proveedor de IA, no aparece
  una próxima acción y no se fabrican fuentes.
- Crafting básico continúa disponible bajo su cobertura limitada. El bloqueo
  avanzado es independiente y no inutiliza Transmutación, Aumento, Regio o
  Exaltado.
- La barrera vive en el servidor: ocultar controles en la interfaz ya no es la
  única defensa contra rutas antiguas, modificadas o desincronizadas.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**801/801** pruebas y **51/51** pruebas dirigidas del Mentor y su API.

## Sesión 85 — la evidencia incompatible falla cerrada en ejecución

- La coherencia entre `patchCompatibility.json` y `releaseEvidence.json` ya no
  depende de una revisión humana. Al arrancar, la API resuelve cada id, comprueba
  área, huella, fecha y parche, y rebaja únicamente la capacidad afectada a
  `review-required` si algo no cuadra.
- La política distingue honestidad de inutilidad: `limited` puede conservar una
  observación cuyo tooltip no muestre versión, pero nunca una evidencia que
  declare explícitamente otro parche. `covered` exige siempre el parche exacto.
- Importación de objetos pasa de `covered` a `limited`, porque su evidencia
  original no muestra por sí sola la versión. Continúa disponible con ese límite
  visible; no se presenta como cobertura completa.
- Una regresión prueba el registro real y exige cero capacidades habilitadas con
  evidencias cruzadas. Otras pruebas manipulan versión y huella para demostrar
  que el servidor las detiene sin bloquear áreas independientes.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**796/796** pruebas y **66/66** pruebas dirigidas de evidencia, compatibilidad y
API.

## Sesión 84 — Crafting avanzado deja de heredar reglas antiguas

- El registro declaraba `advanced-crafting` como utilizable en `0.5.4f`, pero
  sus propias evidencias solo alcanzaban `0.5.0` para Essences y `0.5.3` para
  Alloys. La cobertura queda ahora en `review-required`: una revisión parcial
  ya no se presenta como autorización del parche activo.
- La interfaz conserva las monedas básicas y deshabilita únicamente Essences y
  Alloys con una explicación corta. También desaparecen los accesos secundarios
  que reaparecían al llenar una pieza; el Taller marca esas rutas como «En
  revisión» en vez de permitir prepararlas.
- La barrera no depende del navegador. La API rechaza una sesión avanzada con
  `area-parche-sin-revisar`, mientras una sesión básica del mismo parche sigue
  pudiendo comenzar. Así un cliente antiguo o modificado tampoco puede saltarse
  el control.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**793/793** pruebas, **60/60** pruebas dirigidas de API/compatibilidad y
**98/98** comprobaciones reales del recorrido de equipo y Crafting en desarrollo.

## Sesión 83 — los formatos observados pasan a un corpus único

- Los tooltips de regresión ya no viven repartidos entre pruebas, documentación
  y scripts. `server/fixtures/itemText/corpus.json` registra cuatro formas
  observadas con idioma, parche declarado, procedencia y estructura esperada.
- El catálogo distingue capturas reales del cliente de una reproducción mínima
  derivada del foro oficial. Si la fuente no declara parche, queda escrito como
  `not-stated`: protege el formato, pero no puede autorizar compatibilidad 1.0.
- Un replay automático exige nombre, base, ranura, rareza, nivel, requisitos,
  afijos, estados especiales, advertencias y tipo de bloqueo. Añadir un formato
  nuevo requiere un solo fixture; parser, API y navegador reutilizan el mismo
  caso inglés.
- La guía del corpus prohíbe convertir nombres o afijos observados en reglas
  universales y mantiene cualquier interacción especial sin evidencia en
  `mechanic-unverified`.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**787/787** pruebas y recorrido principal completo en desarrollo y producción.
El replay focalizado de corpus, parser y API aporta **85/85** comprobaciones.

## Sesión 82 — el lector inglés deja de rechazar objetos válidos

- El importador acepta la forma avanzada inglesa observada actualmente en
  tooltips de PoE2: cabeceras `Prefix/Suffix Modifier`, calificadores
  `Fractured`, `Desecrated` y `Mutated`, implícitos con metadatos, `Requires:`,
  calidad modificada y la marca `Fractured Item`. La forma se contrastó con un
  caso reproducible del foro oficial:
  https://www.pathofexile.com/forum/view-thread/3912560
- `Focused Amulet` ya no cae por accidente en la ranura de mano secundaria por
  contener la subcadena `focus`; conserva la identidad y la ranura de amuleto.
- Leer una mecánica especial no equivale a conocer su interacción con cada
  moneda. Los objetos fracturados, profanados o mutados se reconocen, pero el
  guía se detiene con «Mecánica no verificada» y no vuelve a pedir Ctrl+Alt+C ni
  recomienda una acción ordinaria hasta disponer de evidencia del parche.
- La huella de una sesión incluye ahora esos estados especiales para que una
  decisión anterior no sobreviva si cambia la pieza observada.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**782/782** pruebas y recorrido principal completo en desarrollo y producción,
incluido el tooltip avanzado inglés y su parada segura.

## Sesión 81 — la portada deja de repetir y la navegación deja de cortar

- La revisión visual real a 652 y 1440 px encontró dos causas concretas de la
  sensación de carga: la portada explicaba el mismo proceso de nuevo en tres
  píldoras antes de la decisión y, en el ancho intermedio, los nombres largos de
  las áreas aparecían truncados con puntos suspensivos.
- La entrada conserva las tres intenciones, pero llega directamente a ellas. El
  ejemplo queda como ayuda secundaria después de las decisiones y deja de
  competir con «Añadir mi personaje» en la primera lectura.
- Entre móvil y escritorio, la navegación muestra «Expediente», «Plan» y
  «Crafting» completos; desde escritorio recupera los nombres descriptivos
  largos. La regresión mide el recorte real a 640 px, no solo la ausencia de
  desplazamiento horizontal.
- Se corrigió también la documentación histórica del Mentor: el hilo sobrevive
  a una recarga dentro de la sesión mediante `sessionStorage`, pero no se guarda
  en la base de datos ni entre sesiones del navegador.

Verificación: inspección visual a 652 y 1440 px, TypeScript y ESLint sin errores,
build de producción correcto, **776/776** pruebas y recorrido principal completo
en desarrollo y producción.

## Sesión 80 — el personaje importado ya no desaparece al recargar

- Importar un personaje forma ahora una sola operación visible: primero se
  guarda en el servidor y solo después se cierra el alta y se muestra como
  expediente activo. Tanto una instantánea rica de Path of Building 2 como un
  `.build` parcial sobreviven al refresco de la página.
- La persistencia no altera la honestidad del diagnóstico. El PoB2 rico puede
  quedar listo si trae los datos necesarios; el `.build` parcial sigue marcado
  como borrador y bloquea Recomendaciones y Mentor hasta completar sus huecos.
- Si el guardado falla, la interfaz no anuncia éxito ni sustituye el personaje
  anterior: mantiene abierto el alta, conserva el código pegado y permite
  reintentar sin volver a copiarlo. El expediente anterior solo pasa a la zona
  recuperable después de que el nuevo se haya guardado correctamente.
- El recorrido de navegador provoca un fallo controlado, comprueba esos estados,
  reintenta la misma importación y recarga la aplicación para exigir el mismo id
  y las dos piezas equipadas.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**776/776** pruebas y recorrido principal completo en desarrollo y producción.

## Sesión 79 — PoB2 deja de vaciar el personaje importado

- El adaptador anterior descomprimía correctamente el XML de Path of Building
  2, pero descartaba de forma deliberada equipo, atributos, resistencias,
  defensas, gemas y pasivas. Por eso un archivo con datos reales terminaba en
  la interfaz con `0 equipado(s)` y obligaba a completar todo a mano.
- El importador reconstruye ahora el set activo y los campos que la instantánea
  incluya. Los slots de PoB gobiernan la colocación; los modificadores se
  conservan como texto no verificado, y los ids numéricos de pasivas de PoB no
  se presentan como ids oficiales de GGG. Notas y entidades XML se decodifican
  sin habilitar DTD ni entidades externas.
- El contrato sigue siendo honesto: un `.build` oficial de GGG continúa como
  plan o borrador parcial, y un código PoB2 sin equipo o gemas declara esos
  huecos. La sincronización oficial autorizada sigue pendiente.
- Se añadió una instantánea sintética reproducible y se amplió el código real
  ya versionado. El recorrido de Edge importa el perfil rico, exige dos piezas
  en sus ranuras correctas y comprueba que Recomendaciones queda habilitado;
  después prueba que el `.build` parcial continúa bloqueado.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**776/776** pruebas y recorrido principal completo en desarrollo y producción.

## Sesión 78 — Música deja de desaparecer al hacer scroll

- El reproductor continuaba montado en todas las áreas, pero la cabecera que lo
  contenía se desplazaba fuera de la pantalla. Como la navegación sí era fija,
  al bajar por Crafting o el expediente parecía que Música se había eliminado.
- La cabecera global permanece ahora fija y la navegación se ancla justo debajo
  de ella. Música conserva así su nombre y acceso durante todo el recorrido, sin
  solaparse con las tres áreas de trabajo.
- El recorrido de navegador baja hasta el final de la portada móvil y exige que
  Música siga visible, que la cabecera permanezca en el borde superior y que la
  navegación empiece después de ella.

Verificación: TypeScript y ESLint sin errores, build de producción correcto y
recorrido principal completo de navegador en producción.

## Sesión 77 — La publicación exige un contacto real para poe.ninja

- La barrera pública aceptaba cualquier correo o URL con forma válida, incluso
  `example.invalid`. Eso permitía declarar un User-Agent «identificable» que en
  realidad nadie podría atender.
- La validación rechaza ahora localhost, `.local`, `.invalid`, `.test`,
  `.example` y los dominios reservados `example.com`, `example.net` y
  `example.org`, tanto en correos como en URLs. Un contacto real sigue siendo
  suficiente y el modo de mercado offline continúa sin exigirlo.
- La guía de despliegue incluye la variable que faltaba en el bloque mínimo y
  deja el valor deliberadamente sin completar. Copiar documentación ya no
  puede producir por accidente una configuración que la barrera considere
  publicable.

Verificación: la herramienta real aprueba una configuración completa con un
contacto no reservado y bloquea la misma configuración con
`example.invalid`. TypeScript y ESLint sin errores, build de producción
correcto y **774/774** pruebas.

## Sesión 76 — El alta deja de hablar en inglés al cerrar

- La revisión visual confirmó que Plan y Mercado mantiene una sola consulta
  principal y que el importador distingue con claridad personaje actual de
  build objetivo. La auditoría accesible sí encontró un fallo real: el botón X
  del panel «Añadir tu personaje» se anunciaba como «Close».
- Los componentes compartidos de panel lateral y diálogo anuncian ahora
  «Cerrar» y ofrecen el mismo título visible al pasar el cursor. La corrección
  cubre el alta, el detalle de objetos y los demás cuadros que usan esas
  primitivas, sin alterar sus disparadores ni la recuperación de foco.
- El recorrido público abre el alta real y exige exactamente un botón «Cerrar»
  dentro del diálogo y ninguno llamado «Close». La prueba vive junto a la
  auditoría de nombres accesibles, no en una comprobación aislada del JSX.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**771/771** pruebas y recorrido principal completo de navegador en producción.

## Sesión 75 — La mascota deja de ser una zona muerta sobre Crafting

- La revisión visual a 652 px encontró que la mascota parecía compacta, pero
  su botón plegado todavía conservaba un área clicable de aproximadamente
  118 × 131 px. Ese hitbox flotaba sobre campos de Crafting y celdas del equipo,
  aunque la ilustración no pareciera ocupar tanto.
- Hasta 767 px la mascota mantiene el mismo arte y acceso, pero su presencia
  plegada usa un área de 76 × 86 px. En la medición real deja libre el CTA
  principal y reduce de forma material la superficie que puede interceptar un
  clic.
- El recorrido de navegador fija ahora el ancho intermedio de 640 px y rechaza
  cualquier regresión que vuelva a superar 80 × 90 px. La barrera de PoE2 1.0
  se auditó a la vez y permanece cerrada correctamente: el parche aún no está
  publicado y no se atribuyó ninguna evidencia anterior al objetivo 1.0.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**771/771** pruebas y recorrido principal completo de navegador en producción.

## Sesión 74 — El equipo recupera la primera pantalla del Mentor

- La revisión real con el personaje de ejemplo detectó una duplicación de
  jerarquía: la cabecera ya ofrecía «Mentor» y, justo después de la decisión
  principal, aparecía otra franja «Habla con tu Mentor». En móvil esa repetición
  empujaba el equipo fuera de la primera vista.
- La conversación completa conserva su contenido y su estado, pero ahora vive
  después del expediente y el equipo. El acceso global de la cabecera continúa
  abriéndola y desplazando al jugador hasta ella desde cualquier área.
- A 652 × 646 px el inicio del equipo subió de 654 a 559 px y quedó visible en
  la primera pantalla; el briefing repetido bajó de 402 a 1364 px. La regresión
  a 390 px exige explícitamente equipo antes que conversación, acceso global al
  Mentor y ausencia de desbordamiento horizontal.

Verificación: **50/50** comprobaciones específicas del Mentor y **771/771**
pruebas totales. TypeScript, ESLint, build de producción y recorrido principal
de navegador ya habían quedado en verde con esta misma iteración.

## Sesión 73 — Música recupera su sitio y una parada deja de ser un callejón

- Música vuelve a vivir en la cabecera principal, junto a la marca y antes de
  la acción del personaje. Ya no parece una cuarta área de trabajo ni se pierde
  entre las pestañas. Conserva su nombre y el estado «prueba/sonando» desde
  móvil; a 640 px la acción del personaje se compacta para evitar cualquier
  desbordamiento sin ocultar Música.
- Una recomendación que detecta una parada observable ofrece ahora «Ver la
  pieza en mi expediente». La acción abre el detalle de la pieza real y, al
  cerrar, devuelve el foco a su hueco equipado.
- La auditoría del contrato confirmó que `profile.items` ya representa el
  equipo actual: abrir Doom Song no es comparar dos armas. Por eso la guía pide
  «revisar la tirada actual» y reserva la palabra comparar para cuando exista
  una candidata separada. La salida es semántica y una práctica nunca puede
  presentarse como equipo real.

Verificación: **45/45** pruebas del guía, **771/771** pruebas totales,
TypeScript y ESLint sin errores, build de producción correcto y recorrido
principal completo en producción. El navegador comprueba cabecera a 390 y
640 px, consentimiento de Música y el trayecto Crafting → Doom Song → foco del
paperdoll.

## Sesión 72 — Crafting llega al objeto antes de llenar la pantalla

- La revisión visual de Ayuda en vivo a 652 px mostró que las tres formas de
  usar Crafting se apilaban y consumían casi toda la primera vista. La pregunta
  «¿Qué quieres conseguir con esta pieza?» quedaba por debajo, aunque era el
  primer paso real del jugador.
- El selector es ahora una sola franja de tres opciones en móvil e intermedio:
  «Aprender», «En vivo» y «Avanzado». En escritorio recupera títulos y
  descripciones completas. Cada botón conserva siempre el nombre accesible
  largo, por lo que compactar la copia visual no elimina significado.
- La barrera real fija 390 × 844, exige que la franja no supere 100 px y que la
  pregunta sobre el objeto empiece dentro de la primera pantalla. En la prueba
  resultó de 82 px; a 652 px la revisión visual midió 64 px.

Verificación: **110/110** comprobaciones específicas de expediente, equipo y
Crafting, **771/771** pruebas totales, TypeScript y ESLint sin errores, build de
producción correcto y recorrido principal completo sin errores de navegador ni
API.

## Sesión 71 — la recomendación ya enseña cómo volver a PoE2

- La auditoría visual con el personaje de ejemplo confirmó que el caso principal
  mostraba acción, alertas y botones, pero dejaba plegado «Qué comprobar
  después». Eso ocultaba la salida de la web hacia el juego, aunque la promesa
  visible decía que el Mentor enseñaría a comprobar la mejora dentro de PoE2.
- La comprobación empieza ahora abierta y sigue siendo plegable después de
  leerla. La evidencia, fuentes y limitaciones técnicas permanecen cerradas: se
  distingue una instrucción necesaria de un detalle de auditoría.
- El método completo continúa en el nombre accesible y en el título; la copia
  visible se limita a 150 caracteres para que el caso no vuelva a convertirse
  en una pared de texto.

Verificación: **109/109** comprobaciones específicas de expediente, equipo,
recomendaciones y Crafting, **771/771** pruebas totales, TypeScript y ESLint sin
errores, build de producción correcto y recorrido principal completo en
producción. El caso medido conserva 648 px y ningún párrafo visible supera 160
caracteres.

## Sesión 70 — la primera decisión vuelve a caber en la portada móvil

- La auditoría visual de la aplicación real encontró que, a 390 px, el titular
  ocupaba cinco líneas y la tarjeta principal terminaba por debajo de la primera
  pantalla. A 652 px el cambio prematuro a cabecera horizontal estrechaba aún
  más el mensaje junto a «Cargar ejemplo».
- La portada usa ahora una escala tipográfica progresiva, menos relleno en
  móvil y pospone la distribución horizontal hasta 768 px. Los tres pasos
  redundantes se ocultan en móvil y las tarjetas compactan icono, texto y
  espacios sin quitar ninguna de las tres intenciones.
- El recorrido de navegador mide la geometría a 390 × 844: el titular no puede
  superar cuatro líneas y «Añadir mi personaje» debe aparecer completo antes
  del borde inferior. Música conserva a la vez su acceso en la franja fija.

Verificación: **771/771** pruebas, TypeScript y ESLint sin errores, build de
producción correcto, recorrido completo de navegador en producción en verde y
revisión visual real a 390 × 844 y 1280 × 800 sin desbordamiento horizontal.

## Sesión 69 — navegación accesible sin identificadores enfrentados

- El recorrido público comprueba ahora idioma, título, un único encabezado
  principal, nombres accesibles de todos los controles visibles, diálogos con
  nombre e identificadores HTML únicos. La misma barrera se ejecuta en la
  portada, el alta de personaje y el guía real de Crafting.
- La auditoría encontró un fallo real: las vistas «generar» y «otras» de
  recomendaciones se montaban a la vez con `seccion-recomendaciones`. Ahora
  tienen identificadores distintos y el destino programático conserva el
  identificador principal esperado por la navegación y las pruebas del diario.
- La navegación principal queda probada con teclado: Flecha derecha activa y
  enfoca Plan y `Home` devuelve el foco a Expediente. La comprobación espera el
  cambio efectivo de estado para no confundir una animación con un fallo.

Verificación: **771/771** pruebas totales, TypeScript y ESLint sin errores,
build de producción correcto y recorrido completo de navegador en producción
sin errores de interfaz ni API. El mismo recorrido confirma que Música conserva
nombre y acceso en la navegación fija móvil y en ancho intermedio.

## Sesión 68 — el Amuleto distorsionado deja de parecer una copia rota

- El parser ya separaba las dos pasivas asignadas del `Amuleto distorsionado`
  como propiedades fijas y conservaba el implícito que reduce un sufijo, pero
  esa garantía terminaba en pruebas internas. La API pública exige ahora la
  estructura exacta del tooltip real: cero afijos explícitos, dos asignaciones
  fijas y un implícito.
- El recorrido de navegador importa el texto avanzado completo desde la misma
  entrada que usa el jugador. Comprueba que no aparece el aviso de reparación
  y que, al elegir daño físico, el Mentor enseña una Transmutación legal en vez
  de pedir otra copia.
- La migración idempotente de snapshots antiguos permanece cubierta: repara
  solo lecturas contradictorias que aún conservan el tooltip completo; nunca
  completa una pieza parcial por reconocer su nombre.

Verificación: **102/102** pruebas específicas de parser, diagnóstico, acciones,
migración y API; **771/771** pruebas totales; TypeScript y ESLint sin errores.
El recorrido completo de producción confirmó ambos estados visibles del
amuleto y terminó íntegro sin errores de navegador ni API.

## Sesión 67 — Música ya no desaparece al recorrer una página larga

- El reproductor seguía existiendo, pero estaba dentro de la cabecera que sale
  de pantalla al desplazarse; la navegación de áreas permanecía fija y hacía
  que Música pareciera eliminada. Ahora comparte esa franja fija y conserva su
  acceso durante las lecciones y análisis largos.
- El nombre «Música» no se sustituye por un icono en móvil. Entre móvil y
  escritorio, las tres áreas ceden anchura y truncan su rótulo antes de empujar
  el reproductor fuera de pantalla.
- El recorrido real cubre móvil, el ancho intermedio de 640 px, ausencia de
  desbordamiento, consentimiento previo a YouTube y reproducción/detención.

Verificación: TypeScript y ESLint sin errores, build de producción correcto y
recorrido principal completo en producción con todas las comprobaciones en
verde. La revisión visual confirmó Música visible después de desplazar una
lección hasta el final y sin barra horizontal a 637 px útiles.

## Sesión 66 — el origen público exige HTTPS sin sabotear su propia barrera

- `PUBLIC_DEPLOYMENT` comprobaba cookies y proxy al arrancar, pero una ruta
  funcional recibida directamente por HTTP todavía respondía 200 y emitía una
  cookie `Secure` que el navegador podía descartar. Ahora responde 426 antes de
  crear sesión o consumir límites; `/health` y `/ready` permanecen disponibles.
- La regresión reproduce el fallo anterior, exige rechazo directo y acepta la
  misma ruta solo con el protocolo HTTPS aportado por un proxy de confianza.
- Al probar la suite con variables públicas reales apareció un segundo defecto:
  `verify:public` heredaba ese modo durante sus recorridos locales y produjo 73
  fallos 426. La barrera valida primero las variables exactas y después lanza la
  fase larga en un entorno aislado, conservando el parche pero no la base, las
  claves, el proxy ni los proveedores externos. Los ocho smokes también fijan
  `PUBLIC_DEPLOYMENT=false` explícitamente.

Verificación: la regresión previa devolvió **200** por HTTP y quedó roja; tras
el cierre, frontera y barrera pasan **19/19**. La suite completa queda en
**770/770**, TypeScript y ESLint sin errores y build de producción correcto.
El recorrido principal pasó íntegro en producción y desarrollo heredando una
configuración pública válida: usó solo SQLite temporales, no creó la ruta real
marcada para la prueba y dejó libres ambos puertos. La auditoría de las mismas
nueve variables públicas aprobó **9/9**.

## Sesión 65 — los datos del visitante no pueden quedar en una caché compartida

- Las rutas funcionales de la API podían devolver expediente, diario o Mentor
  sin una política explícita de caché. Un CDN o proxy configurado para almacenar
  GET podía reutilizar una respuesta ligada a una sesión.
- Toda respuesta funcional —éxito, error o límite— declara ahora
  `private, no-store, max-age=0`, `Pragma: no-cache` y `Vary: Cookie`. La regla
  se aplica después de asignar la sesión y antes de cualquier controlador.
- `/health` y `/ready` conservan su vía operativa sin cookie, sin límite y con
  `no-store`; no se mezclan con la identidad del visitante.

Verificación: **767/767** pruebas, TypeScript y ESLint sin errores, build de
producción correcto y recorrido principal completo en producción y
desarrollo/Strict Mode. Ambos servidores reales entregaron la política privada
en `/api/character/demo` y mantuvieron los sondeos operativos sin estado.

## Sesión 64 — consultar health ya no rejuvenece datos antiguos

- `dataUpdatedAt` se documentaba como la fecha de los datos usados, pero la API
  lo rellenaba con la hora de cada petición. Una integración futura podía
  presentar cobertura de agosto como si acabara de actualizarse.
- La fecha procede ahora de la evidencia más reciente entre los metadatos del
  parche y su revisión de compatibilidad. Para `0.5.4f` es
  `2026-08-22T00:00:00.000Z`; un parche sin metadatos ni revisión responde
  honestamente `desconocida`.
- El contrato compartido, la API y el recorrido real exigen esa relación. La
  comprobación se adapta al parche activo y no fija agosto como regla del
  producto.

Verificación: **766/766** pruebas, TypeScript y ESLint sin errores, build de
producción correcto y recorrido principal completo en producción y
desarrollo/Strict Mode. La primera barrera rechazó correctamente la huella
anterior de `docs/PLAN.md`; se registró la huella de sus nuevos bytes sin
relajar la auditoría y el catálogo volvió a quedar íntegro.

## Sesión 63 — readiness ya no puede quedar verde por una respuesta antigua

- `/health` y `/ready` emiten `Cache-Control: no-store, max-age=0` y
  `Pragma: no-cache` antes de evaluar su resultado. La regla cubre por igual un
  200 sano y un 503 que debe retirar la instancia del balanceador.
- La política vive en el mismo paso común y sin sesión de ambos sondeos. No
  depende de que cada controlador recuerde añadirla ni afecta la caché de los
  assets estáticos con hash.
- La API prueba explícitamente el 503 de un parche no autorizado y el recorrido
  de navegador exige la política real en los artefactos de producción y
  desarrollo.

Verificación: **56/56** pruebas específicas de API y frontera pública,
**766/766** pruebas totales, TypeScript y ESLint sin errores, build de
producción correcto y recorrido principal completo en producción y
desarrollo/Strict Mode. Ambos servidores reales entregaron `no-store` en
`/health` y `/ready`.

## Sesión 62 — los sondeos del alojamiento ya no crean visitantes fantasma

- `/health` y `/ready` conservan referencia de petición y cabeceras públicas de
  seguridad, pero pasan por una vía sin sesión. Un balanceador ya no recibe ni
  renueva cookies anónimas al comprobar si el proceso vive o admite tráfico.
- Los dos sondeos siguen fuera del límite general de visitante. La separación
  queda centralizada en una única condición para que sesión y limitador no
  puedan divergir en un cambio posterior.
- Las pruebas públicas ya no usan `/health` como fábrica artificial de cookies:
  una sesión nace al acceder a una ruta funcional. Una instancia con límite de
  una petición acepta cuatro sondeos consecutivos sin cookie ni cabeceras de
  cupo, y rechaza correctamente la segunda petición funcional.

Verificación: **56/56** pruebas específicas de API y frontera pública,
**766/766** pruebas totales, TypeScript y ESLint sin errores y recorrido
principal completo en producción y desarrollo/Strict Mode. La guía de
despliegue distingue ahora los límites del visitante de los controles que el
proxy pueda aplicar a sus propios sondeos.

## Sesión 61 — Música vuelve a reconocerse sin cargar la cabecera

- El reproductor nunca había desaparecido funcionalmente, pero el rediseño lo
  había dejado con el mismo gris de los datos secundarios y ocultaba
  «PRUEBA/SONANDO» hasta 1024 px. En la página parecía una función retirada.
- El acceso conserva una sola píldora compacta, ahora con icono y borde dorados
  moderados, nombre estable y estado visible desde 560 px. En móvil estrecho
  mantiene «Música» desde 360 px y el nombre accesible en cualquier anchura.
- Los estados `idle`, `open` y `playing` quedan expuestos al recorrido de
  navegador. La regresión exige nombre propio a 390 px, «PRUEBA» en escritorio
  y «SONANDO» únicamente después del consentimiento explícito. Abrir el panel
  continúa sin crear el iframe ni contactar con YouTube.

Verificación: TypeScript y ESLint sin errores; build de producción correcto;
**764/764** pruebas y recorrido principal completo en producción y
desarrollo/Strict Mode, sin desbordamiento móvil ni errores del navegador.

## Sesión 60 — el respaldo del Mentor ya no es una degradación invisible

- Cuando el proveedor falla y el Mentor responde por reglas, la ruta emite
  `mentor_provider_fallback` con referencia, proveedor y una categoría acotada:
  timeout, HTTP, indisponibilidad, rechazo o respuesta inválida.
- La señal nace después de comprobar la revisión autoritativa del diario. Una
  respuesta descartada por una carrera entre pestañas no se contabiliza como
  degradación servida al jugador.
- El evento excluye pregunta, ocho turnos, respuesta, motivo textual, personaje,
  contexto y objeto. La interfaz conserva su explicación segura para el jugador,
  mientras operación obtiene una métrica agregable para detectar que el Mentor
  está sobreviviendo únicamente gracias a sus reglas.

Verificación específica: **8/8** pruebas del servicio y la ruta; TypeScript y
ESLint sin errores. Una regresión coloca una pregunta privada y un detalle
interno en el fallo, confirma la respuesta 200 por reglas y demuestra que ninguno
aparece en el evento operativo.

## Sesión 59 — los incidentes dejan señal sin copiar datos del jugador

- Cada 429 emite una línea JSON `rate_limit_exceeded` con referencia, ámbito,
  límite y espera. No registra la IP usada por el limitador ni ruta, cookie,
  sesión o contenido de la petición.
- Cada 500 inesperado emite `api_unexpected_error`. Conserva la clase del error
  y una huella de su pila para agrupar fallos, pero excluye deliberadamente el
  mensaje y el objeto de error: una excepción ya no puede copiar accidentalmente
  un tooltip, nombre o texto importado a los registros.
- La guía de despliegue fija los campos que puede indexar el alojamiento y las
  dos señales que deben alertar. La elección del proveedor, retención y umbrales
  reales sigue perteneciendo al despliegue, no al código local.

Verificación específica: **17/17** pruebas de seguridad, limitación y eventos;
TypeScript y ESLint sin errores. Las regresiones demuestran el uso desde el
middleware real, la correlación del 500 y la ausencia tanto de una IP sintética
como de secretos colocados dentro de una excepción.

## Sesión 58 — una publicación pública ya tiene una sola barrera final

- `verify:release` ejecuta ESLint antes de compilar, probar, restaurar y abrir
  todos los recorridos de navegador. Una versión candidata ya no puede quedar
  verde mientras conserva errores estáticos fuera de los flujos visitados.
- `verify:public` valida primero las variables exactas del alojamiento. Si
  detecta modo local, cookies inseguras, proxy abierto, SQLite efímera o
  servicios externos incoherentes, termina antes de gastar tiempo en la barrera
  larga; solo una configuración pública aprobada llega a `verify:release`.
- `verify:public:1.0` añade el auditor estricto de PoE2 1.0 y mantiene separadas
  las evidencias de 0.5.4f. README, guía de calidad y procedimiento de despliegue
  señalan estas dos barreras como las órdenes finales para usuarios reales.

Verificación: la configuración local produce seis bloqueos y salida fallida;
una configuración pública aislada, con Mentor por reglas y mercado offline,
aprueba las nueve condiciones. TypeScript y ESLint sin errores; **759/759**
pruebas. Tres regresiones fijan el orden de lint, configuración pública y
evidencia exclusiva de 1.0.

## Sesión 57 — barrera de navegador vigente en producción y desarrollo

- Se repitieron todos los recorridos públicos sobre bases SQLite temporales y
  aisladas, tanto con la compilación de producción como con Vite/Strict Mode.
  Portada e importación, Equipo/Crafting, Mentor, Taller, Academia, Diario,
  Sesiones y memoria de build vuelven a completar su contrato sin peticiones
  externas ni errores relevantes del navegador.
- El recorrido principal conservaba una aserción de privacidad anterior al
  endurecimiento de la sesión 55. Ahora exige el proveedor concreto, el máximo
  de ocho turnos y las exclusiones de nombre, cookie, afijos crudos y resultados
  libres del diario.
- La recuperación de un expediente podía dar un falso positivo intermitente en
  producción porque la prueba esperaba un nombre que ya aparecía en otro botón.
  El recorrido espera ahora a que desaparezca la acción de recuperación, que es
  la señal real de que el perfil terminó de cargarse.

Verificación de navegador actual: recorrido principal completo; Equipo/Crafting
**218/218**, Mentor **100/100**, Taller **188/188**, Academia **142/142**,
Diario **58/58**, Sesiones **60/60** y memoria de build **20/20**, todo en
producción y desarrollo/Strict Mode. El producto no necesitó cambios para esos
dos hallazgos: eran contratos de prueba desactualizados y ambiguos, ya corregidos.

## Sesión 56 — el limitador público ya no puede crecer sin techo

- Los cuatro limitadores locales conservan ahora un máximo de 10.000 ventanas
  por proceso. Una rotación masiva de IPs ya no puede hacer crecer el mapa en
  memoria durante toda la ventana.
- Al alcanzar el máximo, el almacén elimina primero todas las ventanas
  caducadas; si siguen activas, sustituye la más antigua y mantiene el límite
  físico sin cambiar las respuestas 429 de visitantes aún registrados.
- La guía de despliegue mantiene explícito que esta es una defensa de una sola
  instancia y que el proxy público debe aportar límites compartidos.

Verificación: TypeScript y ESLint sin errores; compilación del servidor público
correcta; **756/756** pruebas. Cuatro regresiones prueban capacidad, sustitución,
caducidad, configuración inválida y el uso efectivo del almacén desde el
middleware público.

## Sesión 55 — el Mentor externo ya no identifica personajes

- El `safety_identifier` de OpenAI deriva ahora de la sesión anónima del
  navegador y nunca del id del personaje. Dos expedientes distintos del mismo
  visitante conservan la misma identidad antiabuso sin exponer la cookie real.
- El contexto externo queda documentado y probado como un resumen acotado. Se
  excluyen nombre del personaje, id de expediente, afijos/tooltips crudos y
  resultados libres del diario; OpenAI conserva además `store:false`.
- La interfaz de Privacidad y la guía de despliegue enumeran lo que puede salir
  del servidor y lo que permanece local, tanto para el Mentor como para Música.

Verificación: TypeScript y ESLint sin errores; **752/752** pruebas; compilación
completa de cliente y servidor correcta. Las regresiones serializan el contexto
entregado al selector y comprueban también la identidad antiabuso a través de la
API real.

## Sesión 54 — la memoria activa del Mentor también vuelve de la copia

- El simulacro de restauración crea ahora una sesión guiada real mediante la
  API, además del expediente y una nota del diario.
- Después de copiar SQLite, validar su SHA-256 e integridad y arrancar otra
  instancia, exige recuperar con la misma sesión anónima el objetivo del Mentor,
  su estado `waiting_result` y el evento que inició la decisión.
- La comprobación del diario busca la nota conservada entre todas sus entradas:
  iniciar una sesión cambia legítimamente la entrada principal y el simulacro ya
  no confunde ese comportamiento con pérdida de datos.

Verificación: simulacro aislado correcto, TypeScript y ESLint sin errores y
**750/750** pruebas. La base real y `DATABASE_PATH` no se leen ni modifican.

## Sesión 53 — el proxy público ya no puede ser «cualquiera»

- La barrera de despliegue rechaza `TRUST_PROXY=true`. Ese valor hacía que
  Express confiara en cualquier salto y podía permitir que una conexión directa
  falseara `X-Forwarded-For`, debilitando los límites por visitante.
- Producción exige ahora `loopback`, una IP concreta o un CIDR no universal.
  El servidor conserva `true` solo como valor legacy detectable para detener el
  arranque antes de abrir el puerto.
- La guía y `.env.example` explican la configuración para proxy en la misma
  máquina o en una red de contenedores, sin presentar el puerto Node como punto
  público directo.

Verificación: TypeScript y ESLint sin errores; **750/750** pruebas; build de
producción correcto. Las regresiones prueban proxy local, IP/CIDR explícita,
`true` inseguro y red universal `0.0.0.0/0`.

## Sesión 52 — evidencia 1.0 sin mezclas ni fechas imposibles

- El auditor de lanzamiento ya no acepta un área porque contenga al menos una
  evidencia válida: **todas** las evidencias enumeradas deben pertenecer al
  parche objetivo, ser nuevas, estar íntegras y corresponder al área declarada.
- La fecha de los metadatos, de la revisión de compatibilidad y de cada
  artefacto debe ser igual o posterior al lanzamiento oficial. Una evidencia
  etiquetada como `1.0` pero observada antes del 11 de diciembre de 2026 no
  puede activar la versión.
- El registro activo del árbol de pasivas se somete a las mismas comprobaciones
  y no puede apoyarse en otra evidencia válida añadida a la misma cobertura.

Verificación: TypeScript y ESLint sin errores; **748/748** pruebas. El informe
real de 1.0 permanece bloqueado por las razones correctas: el lanzamiento sigue
anunciado, no hay metadatos ni revisión posteriores a su publicación, faltan
las cinco coberturas y `DEFAULT_PATCH` continúa de forma segura en `0.5.4f`.

## Sesión 51 — barrera completa y contrato real de navegación

- La barrera completa de release se ejecutó sobre el árbol vigente: restauración
  aislada, equipo y Crafting, Mentor contextual, guía, Academia, diario,
  sesiones y memoria de build pasan en producción y desarrollo/Strict Mode.
- La salida reveló una prueba con contrato antiguo: Sesiones decía que el
  producto tenía dos áreas y que no debía aparecer una tercera, aunque Crafting
  es intencionadamente el tercer espacio principal. La aserción solo comprobaba
  que no volvieran pestañas legacy separadas de Personaje y Mentor.
- La regresión exige ahora `Expediente`, `Plan` y `Crafting`, una sola vez cada
  una, y conserva el rechazo de las dos pestañas antiguas.

Evidencia previa al ajuste final: restauración correcta; Equipo/Crafting
**218/218**, Mentor **100/100**, Taller **188/188**, Academia **142/142**,
Diario **58/58**, Sesiones **60/60** y memoria de build **20/20**.
Tras endurecer la aserción de navegación, Sesiones vuelve a pasar **60/60** en
producción y desarrollo/Strict Mode.

## Sesión 50 — Música visible sin conexión silenciosa a terceros

- El control de Música vuelve a estar presente en la compilación de producción;
  ya no depende de `import.meta.env.DEV`.
- Abrirlo solo enseña el reproductor y la procedencia. El iframe de YouTube no
  existe hasta que el jugador pulsa «Reproducir con YouTube» después de leer qué
  datos técnicos puede recibir el proveedor.
- El diálogo de privacidad distingue esta conexión del Mentor: la música no
  transmite personaje ni expediente.
- El recorrido de producción intercepta YouTube con un doble local y demuestra
  que no hay petición antes del consentimiento y que la conexión solo nace tras
  la acción explícita.

Verificación: TypeScript y ESLint sin errores; **744/744** pruebas; build de
producción correcto; recorrido principal completo en producción y
desarrollo/Strict Mode. El servidor de trabajo `localhost:7201` responde con
portada y API 200 y sirve la CSP corregida.

## Sesión 49 — builds de temporada sin ranking inventado y lectura parcial clara

- «Plan y mercado» incorpora la base de **10 builds destacadas** como selección
  editorial versionada. Cada entrada exige PoE2, liga, parche, autor, fuente,
  presupuesto, categorías, límites y fecha de verificación.
- La API solo devuelve entradas verificadas para la liga y el parche exactos.
  El catálogo inicial queda en 0/10 deliberadamente: no usa endpoints internos
  de poe.ninja, no recicla otro parche y no presenta candidatas como ganadoras.
- Una build aprobada podrá convertirse en objetivo del Mentor y Crafting sin
  sustituir el personaje actual. La interfaz lo declara antes y después de la
  acción.
- Cuando Crafting bloquea una pieza incompleta, ahora separa «Sí he leído» de
  «Todavía necesito». Reconocer la base ya no se confunde con conocer sus
  afijos, estados especiales o nivel de objeto. El informe local conserva la
  misma separación.

Verificación final: TypeScript y ESLint sin errores; build de producción
correcto; **730/730** pruebas, recorridos generales en producción y desarrollo
sin fallos y **191/191** comprobaciones del Taller. En móvil, la tarjeta del
objeto reserva la altura real del Mentor y ya no queda tapada. La nueva sección
se revisó también en `localhost:7201` sin datos inventados.

## Sesión 48 — el guía deja de encadenar monedas sin propósito

- «Más daño» y «más defensa» ya no disparan una receta genérica: el jugador
  concreta la señal que busca (por ejemplo, daño físico, velocidad de ataque,
  vida máxima o resistencias) antes de gastar.
- El resultado se compara contra ese objetivo exacto. Un afijo que no coincide
  detiene la cadena aunque queden huecos; tener espacio libre ya no se presenta
  como razón suficiente para usar Regio o Exaltado.
- Cuando el resultado sí coincide, todavía se revisan requisitos, protecciones
  y el expediente antes de continuar. La maza real de regresión frena con
  Fuerza si se pidió daño físico y reconoce correctamente un afijo físico.
- Un objeto suelto puede usarse para aprender, pero no recibe consejo
  fingidamente personalizado. El guía explica que necesita vincular un
  personaje para juzgar la siguiente inversión.
- El recorrido muestra el objetivo general y el presupuesto disponibles sin
  afirmar que exista una valoración de coste que aún no está verificada.

Verificación: TypeScript y ESLint sin errores; **578/578** pruebas (incluidas
**31/31** específicas del guía); build de producción correcto; taller
**108/108** en producción y desarrollo/Strict Mode.

## Sesión 47 — los datos incompletos ya no expulsan del objeto

- El bloqueo por texto incompleto explica ahora exactamente qué falta: nivel
  de objeto, clasificación de prefijos/sufijos o confirmación del estado de la
  pieza. Si faltan varias evidencias se muestran todas, no solo la primera.
- La acción principal del bloqueo es **Volver a pegar esta pieza** y reabre el
  importador directo. **Elegir otra pieza** queda como alternativa secundaria;
  ya no es necesario reiniciar el objetivo para corregir la copia.
- El servidor de desarrollo de `7201` sirve el cambio mediante recarga en
  caliente. No fue necesario matar ni sustituir su proceso.

Verificación: TypeScript y ESLint sin errores; **571/571** pruebas; build de
producción correcto; recorrido completo del guía **96/96** en producción y
desarrollo/Strict Mode.

### Corrección de instrucciones de copia

La prueba jugando mostró que `Ctrl+C` entrega el formato simple: conserva las
líneas, pero no las cabeceras que identifican prefijos, sufijos, grado y tags.
Todas las entradas del recorrido de Crafting indican ahora **Ctrl+Alt+C**. El
diagnóstico bloqueado enseña la combinación exacta en vez de la frase ambigua
«activa las descripciones avanzadas».

El cliente español puede localizar también los marcadores auxiliares. El
importador reconoce ahora `(runa)`, `(implícito)` y `(encantamiento)`, además de
sus variantes inglesas, para que esas líneas no ocupen falsamente huecos de
prefijo o sufijo.

## Sesión 46 — resultado de Transmutación reconocido y recuperable

- Corregido el fallo descubierto jugando: después de una Transmutación, PoE2
  añade el afijo al nombre visible de un objeto mágico y no repite la base en
  otra línea. El comparador reconoce ahora esa transición como la misma pieza
  cuando coinciden clase, nivel y nombre base; sigue rechazando una clase o una
  base distintas.
- La lectura ya no puede mostrar la contradicción «sin prefijos, 1 sufijo y
  lleno». Si hay una línea explícita que el importador no logró clasificar, la
  enumera como tal, deja los huecos como desconocidos y pide el texto avanzado
  en vez de inventar una estructura.
- Una comparación fallida explica el motivo concreto. El jugador puede pulsar
  **Revisar el texto pegado**, conservar lo que había pegado y corregirlo sin
  reiniciar el objetivo ni perder el snapshot anterior.
- El snapshot del guía solo avanza al resultado cuando la comparación queda
  confirmada; un pegado erróneo ya no sustituye silenciosamente la pieza de
  partida.

Verificación: TypeScript y ESLint sin errores; **570/570** pruebas; build de
producción correcto; recorrido completo del guía **96/96** en producción y
desarrollo/Strict Mode. Incluye una regresión de texto español normal → mágico
con el nombre «de victoria» y otra de recuperación tras pegar una pieza que no
cuadra.

## Sesión 45 — Crafting directo sin personaje

- Corregido el bloqueo descubierto durante la primera prueba real: entrar en
  **Crafting → Ayúdame con mi objeto → Pegar un objeto del juego** ya muestra el
  campo de texto aunque no exista ningún personaje.
- El objeto se analiza primero y solo entonces se crea internamente una sesión
  mínima llamada «Objeto suelto». El jugador no tiene que rellenar nombre,
  clase, nivel, liga ni ningún otro dato para recibir el guía de Crafting.
- El recorrido anterior desde la bienvenida sigue funcionando. Se añadió una
  regresión específica que comienza directamente en la pestaña Crafting, pega
  una pieza realista y comprueba que el guía la recibe sin pedir personaje.

Verificación: TypeScript y ESLint global sin errores; **566/566** pruebas;
build de producción correcto; Academia y acceso directo a Crafting **124/124**
en producción y desarrollo/Strict Mode, sin errores de consola.

## Sesión 44 — estabilización antes de probar jugando

- El barrido completo de calidad queda por primera vez en **cero errores de
  ESLint**. Se corrigieron los 13 avisos heredados de React 19 sin cambiar el
  diseño, las reglas de juego ni los recorridos del producto.
- La detección móvil nace con el valor correcto y reacciona directamente al
  cambio de breakpoint, evitando un render inicial innecesario.
- El diario cancela correctamente una carga anterior si cambia el personaje o
  el componente se desmonta. La restauración sigue funcionando bajo Strict
  Mode sin dejar estados de carga atascados.
- El carrusel elimina ahora todos sus listeners al desmontarse; antes quedaba
  suscrito a `reInit`. Los anuncios del mentor, los valores por defecto y las
  invalidaciones se difieren de forma cancelable para evitar cascadas de
  renderizado. El indicador de carga del mentor ya no lee una ref durante el
  render.

Verificación: TypeScript y ESLint global sin errores; **566/566** pruebas;
build de producción correcto; flujo principal **42/42**, mentor **94/94**,
diario **58/58**, taller de Crafting **90/90** y Academia **120/120**, todos en
producción y desarrollo/Strict Mode. Revisión adicional en `localhost:7201`
sin errores ni avisos de consola.

## Sesión 43 — objetivos concretos y líneas protegidas

- El objetivo natural ya separa la **prioridad principal** de expresiones como
  «sin perder», «conservar» o «mantener». Así, «más daño físico sin perder
  velocidad de ataque» no se confunde con dos objetivos contradictorios.
- Una protección solo existe si sus palabras coinciden con uno o varios
  modificadores explícitos del snapshot. La interfaz enseña las líneas reales
  vinculadas; una petición sin coincidencia queda marcada como no vinculada y
  nunca se trata como un hecho.
- Los ids del importador cambian al volver a pegar el objeto. El guía vuelve a
  vincular las protecciones contra cada snapshot nuevo para conservarlas entre
  pasos. El comparador obliga a parar si desaparece una línea protegida, aunque
  la transición estructural de la moneda sea válida.
- El mentor contextual conoce cuántas líneas están protegidas y cuántas siguen
  sin vincular. La pantalla mantiene una sola acción y un máximo de 130 palabras
  visibles en el recorrido probado.

Verificación: TypeScript y ESLint de archivos modificados sin errores;
**566/566** pruebas; build correcto; guía de Crafting **90/90** en producción y
desarrollo/Strict Mode; 390 px sin desbordamiento y sin errores de consola.

## Sesión 42 — bucle natural «preguntar, jugar y volver»

- Crafting deja de empezar obligando al jugador a traducir su intención a un
  formulario técnico. Ahora pregunta **«¿Qué quieres conseguir con esta
  pieza?»** y acepta una respuesta natural. La interpretación segura inicial
  distingue daño y defensa; una intención ambigua o desconocida pide aclaración
  en vez de inventar una receta.
- El guía conserva el objetivo escrito por el jugador, lo cruza con la pieza
  observada y presenta una sola próxima acción, una petición concreta de datos
  o una parada. La explicación extensa y los posibles resultados quedan
  plegados para que la pantalla principal siga siendo operativa.
- Al pegar el objeto después de actuar en el juego, el comparador mantiene el
  objetivo original, explica qué cambió y envía al mentor contextual el
  resultado y el siguiente paso. El producto acompaña el ciclo; no intenta
  reproducir el crafting dentro de la web.
- El mentor diferencia correctamente entre **hacer una acción**, **aportar un
  dato que falta** y **detenerse**. No presenta una carencia de información como
  si fuera aleatoriedad del juego.

Verificación: TypeScript sin errores; **563/563** pruebas; build correcto; guía
de Crafting **88/88** en producción y desarrollo/Strict Mode; 390 px sin
desbordamiento. ESLint limpio en los archivos modificados. El barrido global
conserva 13 errores preexistentes de reglas React en archivos ajenos a esta
sesión.

## Sesión 41 — Academia media y plan avanzado comprensible

- La Academia ya ofrece Básico, Medio y Avanzado. El nivel medio contiene seis
  comparaciones cortas y enseña a cerrar el bucle antes/después: recuperar un
  resultado incompleto, confirmar identidad, detectar un cambio inesperado,
  frenar una pérdida protegida, parar al cumplir la salida o volver al plan.
- «Diseñar un craft avanzado» pasa a llamarse **Planear un craft**. La pantalla
  deja de enseñar contrato, rutas y herramientas simultáneamente: primero hace
  una pregunta y avanza por objetivo, protección opcional, parada y ruta.
- El contrato se resume al completarlo; objetivo y parada siguen siendo
  editables. Las rutas aparecen solo cuando hay información suficiente. La
  lectura de afijos, estados de conocimiento y selector técnico permanecen
  disponibles sin competir con la próxima decisión.
- El motor, los preflights, las protecciones y las confirmaciones no cambian.

Verificación: TypeScript sin errores; **557/557** pruebas; build correcto;
Academia **120/120** y taller **84/84** en producción y desarrollo/Strict Mode;
390 px sin desbordamiento. ESLint limpio en todos los archivos modificados.

Documento: `docs/CRAFTING_ACADEMY_MEDIUM.md`.

## Sesión 40 — plano experto de Crafting

- El laboratorio ya no repite un comparador decorativo. Muestra un único
  contrato operativo: resultado buscado, líneas que no se deben sacrificar,
  condición de salida y rutas desde el estado actual.
- Cada ruta explica la consecuencia estructural: mantener o cambiar etapa,
  ocupar un hueco o entrar en reemplazo. Los detalles de conservación e
  incertidumbre quedan plegados.
- Si Aumento y Regio son legales a la vez, propone Aumento primero porque
  conserva Regio como opción futura. No llama a esa ruta “mejor” ni inventa
  probabilidades.
- En una pieza rara llena, Essence y Alloy quedan como decisiones manuales que
  exigen tooltip. Si hay líneas intocables, el plano no promete conservarlas.
- Si falta objetivo o parada, las rutas no se pueden ejecutar. Si la pieza ya
  cumple la salida, el plano detiene el gasto.

Verificación: TypeScript sin errores; **547/547** pruebas; build correcto;
taller de Crafting **84/84** en producción y desarrollo/Strict Mode; revisión
manual en escritorio y 390×844. Los archivos del parche pasan ESLint. El lint
global conserva 13 diagnósticos preexistentes fuera de este bloque.

Documento: `docs/CRAFTING_EXPERT_BLUEPRINT.md`.

## Sesión 39 — Mentor v3 fundamentado y conversacional

- Groq ya no se limita a elegir una respuesta preescrita: puede saludar,
  explicar y formular preguntas de seguimiento con texto natural.
- La interfaz envía únicamente los ocho últimos turnos como memoria breve. El
  historial no se persiste y el servidor lo trata como texto no confiable.
- La redacción debe citar recomendaciones o carencias canónicas. El servidor
  rechaza ids internos, campos técnicos, HTML, enlaces y cifras ausentes del
  contexto; ante cualquier duda usa el respaldo de reglas.
- Una acción activa del diario sigue mandando. Mentor v3 no abre otra decisión
  en paralelo ni convierte la conversación en una fuente nueva de hechos.
- La revisión real en `localhost:7201` confirmó una respuesta natural de Groq a
  «Hola» y una pregunta de seguimiento basada en el personaje demo, ambas con
  `openai/gpt-oss-120b` y sin errores de consola.
- Esa revisión detectó y corrigió una regresión exclusiva de HMR: el contador
  de turnos podía reutilizar claves tras una recarga en caliente. Los turnos
  usan ahora UUID y la repetición en una pestaña limpia termina sin avisos.

Verificación: TypeScript sin errores; **541/541** pruebas; build de producción
correcto; mentor **47/47** en producción y **47/47** en desarrollo/Strict Mode;
taller de Crafting **84/84**. ESLint pasa en todos los archivos modificados
salvo `App.tsx`, que conserva los **10 diagnósticos preexistentes** de React
Hooks del baseline y no añade ninguno en las líneas de Mentor v3.

## Sesión 38 — Mentor v2 contextual y supervisado

- Cada consulta puede llevar un `ContextEnvelope` v1 con el área, pieza y estado
  visible. El servidor lo trata como no confiable y reconstruye personaje,
  build, presupuesto, moneda y liga desde los inputs canónicos.
- Una pieza o recomendación enviada por la interfaz solo llega al selector si
  su id existe realmente. Objetivo libre de crafting y última acción quedan a
  `null` mientras no puedan validarse contra estado autoritativo.
- Groq sigue siendo un selector: devuelve únicamente un tipo de decisión y los
  ids permitidos. El servidor redacta la respuesta desde la recomendación o el
  dato faltante real; IDs inventados, errores o respuestas inválidas vuelven a
  las reglas.
- El guía de Crafting sincroniza la pieza seleccionada con el contexto global.
  Al elegir daño o defensa, el mentor deja el aviso genérico y muestra la pieza
  y el siguiente paso legal calculado por el guía. No consume cuota hasta que
  el jugador pulsa «Analizar este contexto».
- Se añadieron regresiones contra manipulación del envelope, prompt injection,
  ids inexistentes y fallo del proveedor. La revisión manual en `localhost:7201`
  confirmó el cambio de contexto al inspeccionar la ballesta y elegir daño.

Verificación: TypeScript sin errores; **533/533** pruebas; build de producción
correcto; mentor **88/88** y taller de Crafting **84/84**, ambos en producción y
desarrollo/Strict Mode. ESLint pasa en todos los archivos modificados; el lint
global conserva los **13 diagnósticos preexistentes del baseline**.

## Sesión 37 — una sesión de craft ya no bloquea el banco

- Pausar un craft lo guarda como caso reanudable y libera inmediatamente el
  banco. El jugador puede preparar otra pieza o herramienta sin abandonar el
  progreso anterior.
- Crafting lista los casos pausados y reanuda el elegido por su identidad, no
  «el último» por accidente. Si ya hay otro caso activo, impide mezclar ambos.
- «Cerrar sin aplicar» descarta de forma explícita el caso abierto, limpia su
  acción viva del diario y conserva el historial; nunca simula que la moneda se
  usó.
- Antes de elegir moneda aparece una decisión visible sobre la base: gastar,
  aportar primero el objetivo o no reemplazar todavía. Solo usa estructura,
  grados, protecciones y objetivo conocidos; no inventa valor, probabilidad ni
  resultado.
- Después de pegar el objeto resultante, la acción principal sigue la decisión
  estructurada: continuar, parar o replantear. El sí/no manual queda únicamente
  como respaldo para sesiones antiguas sin esa decisión.

Verificación: TypeScript sin errores; **481/481** pruebas; build de producción
correcto; equipo/Crafting **212/212**, sesiones **60/60**, diario **58/58**,
memoria de build **20/20**, mentor **88/88** y flujo principal completo en
producción y desarrollo/Strict Mode. El lint directo conserva **13 diagnósticos
preexistentes del baseline** (React Hooks en `App`, carrusel y hooks); el diff de
esta sesión no modifica ninguna de las líneas señaladas.

## Sesión 36 — menos lectura antes de una moneda aditiva

- La lista completa de modificadores intocables queda plegada cuando la ruta
  actual solo añade. El resumen conserva el contador y permite abrirla en un
  clic si el jugador quiere preparar después una Essence o un Alloy.
- Cuando la pieza está llena y la ruta exige reemplazar, la protección se abre
  y permanece visible: la reducción visual nunca oculta el riesgo material.
- La vista inicial baja de 297 a **222 palabras** y de 2102 a **1637 px** en un
  viewport móvil de 375×844, sin desbordamiento horizontal.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**479/479** pruebas y equipo/Crafting **204/204** en producción y
desarrollo/Strict Mode.

## Sesión 35 — objetivo y parada guiados por la interfaz

- Elegir una categoría como «Daño» ya define un objetivo suficiente; el matiz
  libre pasa a ser opcional. «Otro objetivo» sigue exigiendo que el jugador lo
  describa y nunca se interpreta como evidencia.
- El banco propone en un clic el siguiente umbral observable. En la ballesta de
  prueba muestra «Un afijo de daño más · Ahora hay 3; para al llegar a 4» sin
  afirmar que el nuevo afijo será bueno.
- La ruta principal no abre un preflight bloqueado: primero lleva y enfoca el
  objetivo pendiente, después la condición de parada y solo entonces permite
  preparar la moneda.
- El mentor contextual reacciona localmente a la pieza, el objetivo, la parada
  y la moneda elegida. No llama automáticamente a Groq ni consume cuota; la
  consulta supervisada sigue requiriendo «Analizar este contexto».
- Se eliminó una carrera de foco visible únicamente en desarrollo/Strict Mode.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**479/479** pruebas; equipo/Crafting **202/202** y mentor **88/88** en
producción y desarrollo/Strict Mode. Vista inicial: 297 palabras, 375/375 px y
2102 px de alto a 375×844.

## Sesión 34 — nivel desconocido coherente en toda la aplicación

- `readCharacterLevel()` es ahora la única lectura usada para decidir o
  presentar el nivel: motor, mentor supervisado, diario y cabeceras dejan de
  convertir el placeholder técnico `1` en un hecho del personaje.
- Los requisitos de equipo y la heurística de vida piden el nivel real cuando
  falta; no bloquean, no calculan una expectativa y no dicen «eres nivel 1».
- El contexto enviado al selector de IA usa `null` para nivel desconocido. El
  diario guarda además la procedencia y trata conservadoramente como desconocido
  cualquier `1` legacy sin procedencia.
- El editor muestra el campo vacío con placeholder «Desconocido». Un nivel 1
  escrito por el jugador conserva `observed` y sigue siendo un nivel real.
- La huella de sesiones no cambia: sigue usando el número técnico para no
  invalidar memorias existentes solo por añadir procedencia.

Verificación: TypeScript y ESLint sin errores, build de producción correcto,
**477/477** pruebas; flujo principal completo, diario **58/58**, mentor
**88/88**, sesiones **58/58** y equipo/Crafting **192/192**, siempre en
producción y desarrollo/Strict Mode.

## Sesión 33 — Crafting sabe cuándo parar

- Cada pieza admite entre una y tres condiciones de éxito observables elegidas
  por el jugador: más afijos de la categoría objetivo, una línea exacta nueva o
  un número mínimo de afijos explícitos.
- Los umbrales ofrecidos siempre superan el estado del snapshot. «Conservar
  intocables» sigue siendo una restricción de seguridad y no se confunde con
  haber mejorado la pieza.
- Las condiciones viajan con Monedas, Essences y Alloys y quedan persistidas en
  `craftingExperiment`. Las sesiones antiguas reciben una lista vacía y
  mantienen el comportamiento anterior.
- El resultado separa «cumplida», «no aparece» y «no comprobable». El texto
  libre del objetivo nunca se interpreta como prueba.
- Si todas las condiciones se cumplen, la recomendación dominante es «Objetivo
  cumplido: para y conserva», incluso si queda espacio para seguir gastando.

Verificación: **462/462** pruebas unitarias en la primera pasada completa; las
regresiones específicas siguen en verde tras la corrección conceptual;
TypeScript y ESLint sin errores; build de producción correcto; equipo y
Crafting **192/192** en producción y desarrollo/Strict Mode. Vista inicial:
300 palabras, 375/375 px y 2102 px de alto a 375×844.

## Sesión 32 — una intención compartida para todo el banco

- Crafting ya no pide el objetivo por separado en Monedas, Essences y Alloys.
  Existe una sola intención por pieza: objetivo principal, matiz libre y líneas
  del objeto que el jugador marca como «intocables».
- Las categorías se eligen mediante botones visibles. Los afijos se marcan con
  tarjetas/checkboxes y muestran un contador; también existe un atajo explícito
  para grados 1–2, sin seleccionarlos automáticamente.
- La misma intención acompaña a las tres herramientas y se persiste en la
  sesión/comparación. Si cambia el snapshot, los ids antiguos dejan de aplicarse
  y el jugador vuelve a confirmar sobre la pieza nueva.
- El núcleo de afijos muestra las restricciones elegidas aunque no coincidan
  con el objetivo principal. La explicación extensa del mentor queda plegada:
  la vista inicial conserva el plan y la siguiente acción como protagonistas.

Verificación: **457/457** pruebas; TypeScript y ESLint sin errores; build de
producción correcto; equipo y Crafting **192/192** en producción y
desarrollo/Strict Mode. Vista inicial: 291 palabras, 375/375 px y 2010 px de
alto a 375×844.

## Sesión 31 — lectura observable del núcleo de afijos

- Crafting añade un resumen compacto «Núcleo de afijos» que cruza el objetivo
  con las etiquetas y grados del texto avanzado real.
- Distingue «Protege primero», «Aporta al objetivo», «Revisa su encaje» y
  «Depende de la build» sin convertir estas señales en una puntuación.
- Detecta convergencias específicas entre varios afijos y mantiene el detalle
  completo plegado por defecto.
- Se corrigió un falso positivo importante: la etiqueta genérica «Ataque» ya no
  basta para declarar daño directo. Un afijo de precisión con esa única etiqueta
  queda como contexto, no como mejora de daño demostrada.
- Validación manual con «Rama de alma»: 3/6 afijos alineados con daño, dos con
  convergencia física y un afijo alineado de grado 1–2.

Verificación: **456/456** pruebas; TypeScript y ESLint sin errores; build de
producción correcto; equipo y Crafting **190/190** en producción y
desarrollo/Strict Mode.

## Sesión 30 — asesor conservador después de cada craft

- Una pieza llena con afijos de grado 1–2 ya no recibe la recomendación
  engañosa «Prueba controlada»: el banco indica «No arriesgues aún» y muestra
  cuántos afijos relevantes quedarían expuestos.
- Las rutas de reemplazo con Essence o Alloy permanecen ocultas y desactivadas
  hasta que el jugador revisa explícitamente ese riesgo.
- Tras pegar el resultado, aparece una sola decisión dominante: continuar,
  parar y conservar o replantear la ruta. La decisión distingue un resultado
  útil con hueco libre, uno útil que llena la pieza y uno lleno sin señal del
  objetivo.
- Los bloqueos por requisitos o por pérdida de un modificador protegido siempre
  prevalecen. No se destruye ningún objeto ni se inventan DPS, precios,
  probabilidades o valor de afijos.

Verificación: TypeScript y ESLint sin errores; **452/452** pruebas; build de
producción correcto; equipo y Crafting **186/186** en producción y
desarrollo/Strict Mode.

## Sesión 29 — banco de crafting jugable y navegación reparada

- Crafting deja de empezar como una tabla técnica: primero pregunta qué busca
  el jugador y resume en cuatro señales compactas si debe esperar, probar de
  forma controlada o revisar la pieza.
- La lectura separa modificadores con coincidencia literal con el objetivo,
  modificadores sin señal directa y afijos de grado 1–2 candidatos a conservar.
  No llama «malo» a un mod ni inventa DPS, precio, pesos o probabilidad.
- Monedas básicas pasan de tres confirmaciones repetidas a una confirmación
  compacta que conserva las mismas tres condiciones de seguridad. La ruta
  mínima desde un objeto suelto queda en seis interacciones.
- El detalle del objeto ya no duplica el planificador entero: muestra el objeto,
  sus datos y un único botón para llevarlo al banco.
- Todas las piezas muestran una ilustración local por clase/hueco y rareza en
  equipo, detalle y Crafting. Son siluetas propias y deterministas, no arte de
  GGG ni una imagen exacta resuelta desde BaseItemTypes.
- La marca «Exile Copilot» vuelve siempre al expediente. Un botón Volver recupera
  el área anterior sin recargar la página.

Verificación: TypeScript y ESLint sin errores; **447/447** pruebas; build de
producción correcto; equipo y Crafting **184/184**, flujo principal completo y
mentor **88/88** en producción y desarrollo/Strict Mode.

## Sesión 28 — auditoría adversarial y ruta de próxima decisión

- Se recorrió en navegador el ciclo completo desde objeto suelto hasta
  comparación, valoración y actualización del mismo objeto.
- Se corrigió una contradicción del dominio: una base normal sin afijos ya no
  aparece bloqueada y entra por Transmutación; una base normal con explícitos
  sigue deteniéndose como inconsistente.
- Ausencia de estados especiales, dividido, sin identificar, mutado y
  profanado ya no pueden presentarse como «pieza lista».
- El diagnóstico ahora termina en una acción visible: prepara la única moneda
  compatible, muestra todas si existen varias sin inventar un ranking, o lleva
  a Essence/Alloy cuando un raro lleno necesita reemplazo.
- La ruta es navegación sobre compatibilidad ya demostrada: no interpreta
  utilidad de afijos, no calcula probabilidades y no declara compatible una
  herramienta cuyo tooltip todavía no se ha pegado.

Informe completo: `docs/CRAFTING_ADVERSARIAL_AUDIT_2026-08-23.md`.

## Sesión 27 — entrada orientada a tareas

- La pantalla vacía ya no obliga a entender la arquitectura del producto:
  pregunta «¿Qué quieres hacer hoy?» y ofrece tres recorridos completos.
- «Mejorar mi personaje» abre el importador existente; «Empezar desde cero»
  crea un perfil local editable; «Evaluar o craftear» acepta directamente el
  texto de un objeto y abre el banco de Crafting con esa pieza seleccionada.
- El perfil manual no se presenta como importado ni se persiste hasta que el
  jugador lo guarda. Un objeto suelto tampoco requiere fingir que existe un
  personaje completo.
- El smoke principal prueba las tres rutas en producción y desarrollo. La
  limpieza de temporales de Windows informa un bloqueo tardío de antivirus o
  indexadores sin convertirlo en un falso fallo funcional.

## Sesión 26 — Alloys guiados y comprobables

- Nuevo preflight propio para Alloys dentro de Crafting. No deduce el efecto
  por el nombre: exige nombre, tooltip, objetivo, rareza, modificador fabricado
  garantizado y forma de selección del reemplazo observados por el jugador.
- La regla global se limita a lo demostrado por GGG en 0.5.0: reemplazo de un
  modificador por uno fabricado garantizado y máximo de un fabricado por objeto.
  La matriz Alloy × pieza y la forma de retirada no se inventan.
- Se bloquean estados incompatibles conocidos y se detienen como «Faltan datos»
  las interacciones especiales no verificadas.
- La sesión persistente conserva el snapshot, el Alloy, el efecto declarado y
  el contrato de comparación. El resultado solo se confirma si desaparece un
  explícito, aparece uno fabricado y no hay más de un fabricado total.

Verificación: TypeScript y ESLint sin errores; **421/421** pruebas; build de
producción correcto; flujo real de navegador **138/138** entre producción y
desarrollo/Strict Mode. Los puertos temporales 7188/7189 se liberaron.

## Sesión 24 — motor matemático conservador de crafting

- Nuevo contrato separado para pools completos, parciales, observados y no
  disponibles. Peso desconocido es `null`; peso conocido cero conserva su
  significado matemático.
- La probabilidad exacta solo se calcula con alcance, pesos y elegibilidad
  completos. Incluye intentos medios, acumulada a N intentos y coste esperado
  únicamente con precio verificado y fechado.
- Las secuencias usan probabilidades condicionales. El coste hasta acertar se
  bloquea si no está demostrado que cada fallo puede reiniciarse al mismo estado
  y cuánto cuesta ese reinicio.
- El comparador de estrategias solo ordena costes totales en la misma moneda;
  no confunde coste matemático con utilidad para la build.
- Los fixtures son sintéticos y no representan mods ni pesos reales de PoE2.
  La conexión con pools reales queda bloqueada hasta que el registro de datos
  entregue un snapshot `verified-complete`.

Pruebas específicas del motor: **22/22**; suite global **367/367**, TypeScript y
ESLint sin errores y build de producción correcto. Véase
`docs/CRAFTING_MATH_ENGINE.md` para los invariantes y límites.

## Sesión 23 — cierre de consistencia del banco de Crafting

- El preflight ya no se duplica dentro del detalle del objeto: allí solo se
  consulta el diagnóstico y se navega al banco de Crafting con la pieza elegida.
- Solo se monta una instancia viva de la sesión de crafting; el expediente
  muestra un enlace de retorno cuando el caso activo pertenece al banco.
- La comparación exige coincidencia conocida de base y nivel de objeto. Nivel
  ausente, dos mods nuevos, roll cambiado o transición inesperada quedan como
  inconclusos o incompatibles, nunca como confirmación.
- La evidencia estructural y la valoración subjetiva se persisten por separado.
  El expediente se guarda antes de cerrar; si falla, la sesión sigue abierta y
  puede reintentarse. Un cerrojo síncrono impide cierres concurrentes.
- La prueba de navegador simula de forma explícita un fallo de guardado y comprueba
  la recuperación completa contra SQLite. Su espera usa sondeo real del servidor,
  no una promesa asíncrona que pudiera producir un falso positivo.

Verificación: TypeScript y ESLint sin errores; **345/345** pruebas unitarias;
build de producción correcto; flujo de equipo y crafting **120/120** en
producción y desarrollo, repetido dos veces seguidas (**240/240**). También
pasan flujo principal **32/32**, diario **58/58**, mentor **88/88**, sesiones
**58/58** y memoria de build **20/20**. Los puertos temporales se liberan al
terminar.

## Sesión 22 — primer ciclo cerrado de crafting

- «Crafting» es una tercera pestaña principal junto a «Expediente y mentor» y
  «Plan y mercado»; selección, preflight, sesión y comparación permanecen en
  ese espacio de trabajo.
- El importador español conserva prefijo/sufijo, grado, etiquetas, fabricación,
  profanación, runas, implícitos y estados de crafting a partir del texto
  avanzado aportado por el jugador.
- Una matriz conservadora evalúa Transmutación, Aumento, Regio y Exaltado con
  sus variantes observadas; no inventa variantes, pesos ni probabilidades.
- La variante exacta elegida (base/superior/perfecta), su etiqueta y el nivel
  mínimo mostrado por el tooltip se guardan en la sesión. Los registros
  anteriores siguen cargando sin que se les invente una variante base.
- Antes de gastar se crea una sesión con snapshot estructurado del objeto,
  moneda protegida, objetivo del jugador, incógnitas y restricciones.
- Al volver del juego se pega el nuevo objeto. La app compara base, nivel de
  objeto cuando está presente, rareza y el multiconjunto completo de mods; solo
  confirma si se preserva todo y aparece exactamente un explícito nuevo.
- La valoración «me sirve / no era lo que buscaba» queda separada de la
  comparación factual. El resultado y el snapshot persisten en el diario, y el
  expediente sustituye el objeto conservando su id y su hueco local.
- Sesiones antiguas siguen siendo válidas: `craftingExperiment` es opcional.

Verificación histórica de esa sesión: TypeScript y ESLint sin errores;
**330/330** pruebas; build correcto; navegador de equipo y crafting **112/112** en producción y en
desarrollo/Strict Mode. Los puertos temporales 7188/7189 se liberan al acabar.

## Sesión 21 — endurecimiento del mentor contextual

Se cerraron los defectos descubiertos en la auditoría del panel contextual:

- Todas las preguntas creadas por la interfaz llevan una intención permitida y
  una prueba de contrato las enfrenta al clasificador determinista.
- La procedencia visible sale de `responseMode`: IA supervisada con su modelo,
  respaldo por reglas o motor. Ya no se presenta cualquier respuesta como Groq.
- Cada petición lleva identidad propia. Cambiar de área, objeto o decisión
  invalida el panel anterior; una respuesta tardía no puede pisar el contexto
  nuevo ni un turno viejo puede cerrar el estado de uno reciente.
- El panel ya no se reconstruye al responder: conserva plegado y foco. Empieza
  plegado en escritorio y móvil para no interceptar acciones del expediente,
  pero su cabecera sigue reaccionando a los eventos semánticos.
- Presupuesto se anuncia con debounce; guardar perfil, importar plan, aplicar o
  invalidar una recomendación, resultados/pausas de sesión y errores producen
  cues específicos. Sin personaje se muestra un estado honesto y sin consulta.
- La región viva accesible es estable; el contenido móvil tiene alto acotado y
  el botón de teclado conserva el foco tras respuestas síncronas o remotas.

Verificación final: TypeScript y ESLint sin errores; **309/309** pruebas;
build correcto; mentor **88/88**, equipo **82/82**, sesiones **58/58**, diario
**58/58** y flujo principal completo en producción y desarrollo/Strict Mode.

## Sesión 18 — Groq como proveedor del mentor IA

El selector de Hito 6E ahora acepta proveedores compatibles y usa Groq por
defecto. `MENTOR_AI_PROVIDER=groq`, `GROQ_API_KEY` y
`openai/gpt-oss-120b` permiten probar el mentor con la cuota gratuita de Groq.
La clave permanece exclusivamente en el servidor.

- Groq usa `https://api.groq.com/openai/v1/responses` con JSON Schema estricto.
- No se le envían `store` ni `safety_identifier`, campos que su Responses API no
  admite. OpenAI sigue disponible y conserva ambos controles.
- La salida vuelve a validarse con Zod y todos los ids se comprueban contra el
  contexto canónico. Ante cualquier error, el motor responde por reglas.
- Desactivado por defecto: sin flag o sin clave no hay petición externa.

## Sesión 17 — Hito 6E: mentor IA supervisado

Rama aislada `hito-6e-mentor-ia` sobre `f55aef2`. La IA es un selector opcional,
no un segundo motor: recibe un contexto compacto, trata todo texto del usuario
como dato no confiable y devuelve únicamente una decisión estructurada.

- Puede elegir uno de los ids de recomendación del motor, pedir uno de los ids
  de dato faltante, explicar el caso actual o declarar que no hay acción segura.
- El servidor valida todos los ids y reconstruye acción, fuentes, confianza y
  texto final. El modelo no puede persistir memoria ni crear cambios de juego.
- Una acción activa evita por completo la llamada IA. Los frenos Core y de
  sesión siguen gobernados por el motor.
- En OpenAI se usan `store:false` e identificador de seguridad pseudónimo. En
  Groq se omiten esos campos incompatibles. Timeout y salida máxima siguen
  configurables; flag y clave solo en servidor, desactivado por defecto.
- Si falta clave, hay timeout, error HTTP, negativa, salida incompleta, JSON
  inválido o un id inexistente, responde el motor y muestra el motivo seguro.
- Groq puede usarse con su cuota gratuita; OpenAI conserva facturación separada
  de ChatGPT. No se guarda ninguna clave en el repositorio.

Verificado localmente: TypeScript y ESLint sin errores, **297/297** pruebas,
build de producción correcto, smoke normal **72/72** (producción + desarrollo)
y smoke con IA activa sin clave **36/36**, sin peticiones externas. La llamada
real queda pendiente de una clave y presupuesto de API proporcionados por el
propietario.

## Sesión 16 — Hito 6D: identidad persistente de la build

Rama aislada `hito-6d-build-memory` sobre `2576577`. El expediente conserva
reglas declaradas por el jugador como **Core, Flexible, Experimental o
Descartado**, con motivo, objeto relacionado opcional y condición para volver a
considerar algo descartado.

- Las reglas viven en SQLite y sobreviven a recargar. Archivar las retira de la
  memoria activa sin borrar su historial físico.
- La memoria forma parte de la revisión determinista del personaje. Dos
  pestañas que escriben desde la misma revisión no pueden pisarse: la primera
  gana y la segunda recibe `409 memoria-diario-obsoleta`, recarga y no duplica
  la regla.
- Un objeto relacionado debe existir en el snapshot guardado. Un id ajeno se
  rechaza con `400 objeto-de-memoria-desconocido`.
- Solo una regla Core puede frenar automáticamente, y únicamente con una
  relación estructurada por id de objeto o la coincidencia textual conservadora
  ya existente. Flexible, Experimental y Descartado no se convierten en hechos
  ni mecánicas inventadas.
- El personaje de ejemplo explica que primero debe guardarse y ofrece
  «Guardar personaje y activar memoria»; después permite añadir, reclasificar y
  archivar reglas desde el expediente.

Verificado en esta rama: TypeScript y ESLint sin errores, **284/284** tests,
build de producción correcto, smoke 6D **20/20** (producción + desarrollo,
escritorio + móvil a 390 px) y regresión 6C **58/58**. Las cuatro capturas están
en `docs/screenshots/memoria-build-*.png`.

## Sesión 15 — Hito 6C: ciclo «Probar y volver»

Rama aislada `hito-6c-return-loop` sobre `5f726a2`. El objetivo es convertir
una recomendación en un ciclo reconocible y útil fuera de la web:

1. **Probar y volver.** La recomendación nombra una acción y explica de forma
   visible qué observar después del cambio.
2. **Volví de jugar.** El retorno no exige redactar un informe: ofrece cinco
   resultados rápidos (resuelto, mejoró, igual, empeoró o algo diferente) y un
   comentario opcional.
3. **Continuidad honesta.** «Resuelto» cierra el caso; los resultados parciales
   lo mantienen abierto; un hallazgo valioso inesperado cambia la estrategia.
   Una sensación se conserva como experiencia del jugador, nunca como medición.
4. **Menos ruido.** Evidencias y protecciones avanzadas permanecen disponibles
   dentro de un bloque secundario. El informe de exportación queda plegado por
   defecto.

La compatibilidad con sesiones anteriores se conserva: `outcome` es nullable y
los registros antiguos se leen como resultado no estructurado. El motor sigue
siendo determinista; no se añadieron precios, crafts ni conocimiento inventado.

## Sesión 14 — microcorrección de consistencia posterior al 6B

Rama `post-6b-consistency`, worktree aislado sobre `dd671178`. Sin funciones
nuevas ni cambios visuales.

- **El objetivo de la sesión deja de perderse.** `goal` era un `z.string()`
  libre; la interfaz mandaba `"balanced"` fijo en sus dos caminos y el servidor
  ni siquiera lo pasaba al servicio, así que la entrada del diario nacía con
  `goal: null`. Ahora usa el enum del dominio (`GoalKind`), la sección lo recibe
  desde `App.tsx`, la ruta lo entrega al servicio, la sesión lo conserva y sus
  entradas lo heredan. Las sesiones guardadas antes de este campo se cargan con
  `goal: null` = **desconocido**, sin inventarles «equilibrado».
- **`equipment-smoke` y `browser-smoke` ya no pueden tocar la base real.** Usan
  el mismo patrón que los otros tres smokes: carpeta temporal única por
  ejecución y `DATABASE_PATH` explícito, con limpieza en `finally` y validación
  de la ruta absoluta antes de borrar (helpers en `scripts/browserLaunch.mjs`).
  Cada smoke comprueba en ejecución que su base es la temporal.
- **Documentación al día**: lo que era «sin integrar», «sección 5» o SHA del
  repositorio de Grok queda marcado como historia o corregido.

## Sesión 13 — Hito 6B corregido tras auditoría independiente

Rama `hito-6b-corregido` (worktree aislado sobre el entonces baseline
`f6152c47`). **Ya integrada en `main`** mediante `hito-6b-integracion`
(fast-forward a `dd671178`). Parte del patch original de Grok (commit `e6288f2`,
conservado sin tocar como prototipo) y aplica las nueve correcciones que exigía
`AUDITORIA_HITO_6B_GROK.md`.

- **SQLite es la fuente autoritativa del personaje.** Toda operación de sesión
  carga el perfil guardado DENTRO de la transacción (`loadAuthoritativeProfile`).
  El `profile` que envía una pestaña ya no decide nada: una pestaña antigua que
  reenvía su snapshot recibe `sesion-incompatible-con-perfil` (409). Trabajar con
  una sesión exige un personaje guardado (`personaje-no-guardado`).
- **Huella completa y estable**: nivel, liga, parche, vida y defensas, atributos,
  resistencias, habilidades, pasivas y el CONTENIDO del equipo (slot, id, base,
  rareza, calidad, requisitos y mods). Todas las colecciones se ordenan por clave
  estable y se excluye lo volátil (fechas, `sources`, `rawText`): reordenar no
  cambia la huella, editar sí.
- **Invariante de próxima acción**: tras `continue` o `change_strategy` la sesión
  abierta siempre tiene una entrada principal viva con
  `activeAction.journalEntryId === primaryEntryId`. En transiciones terminales el
  id se pone a `null`: nunca apunta a una entrada completada.
- **Desbloqueo real por evidencia**: la recomendación frenada se conserva
  validada (`blockedRecommendation`) junto al presupuesto aceptado. Al resolver
  la incógnita crítica se REEVALÚA el freno y, si ya es seguro, se restaura la
  acción original con sus fuentes, coste, riesgo e ids.
- **Historial cerrable**: `MAX_SESSION_EVENTS` (40) acota el material; las
  transiciones terminales disponen de `RESERVED_TERMINAL_EVENTS` (2) plazas
  extra. Una sesión con el historial lleno SIEMPRE puede pausarse, cerrarse o
  descartarse, y el mensaje de error nombra esas acciones.
- **Retención honesta de ocho sesiones**: `enforceSessionRetention` se aplica en
  la misma transacción al abrir y al cerrar. Solo borra sesiones YA CERRADAS y
  nunca la activa: no se pierde historia viva en silencio.
- **Restricciones no aplanadas**: el digest publica `constraints` (label + sus
  itemIds) y el freno atribuye el conflicto a la protección que POSEE el id, no
  a la primera de la lista.
- **Interfaz coherente por estado**: una sesión cerrada no ofrece resultado,
  evidencia ni pausa, y expone «Empezar otra decisión»; hay un selector visible
  de qué incógnita resuelve la evidencia (antes dependía de un estado local que
  se perdía al recargar); y cada protección se puede retirar a conciencia
  (`POST /session/constraints/release`), que es lo que el texto del conflicto
  proponía sin ofrecerlo.
- **Idempotencia ligada a la operación**: cada evento guarda `operation` y una
  huella estable del request. La misma clave con otra ruta u otro payload
  devuelve 409 `clave-de-idempotencia-reutilizada` en vez de un éxito silencioso.

### Estado del prototipo original

El patch de Grok aplica limpio y compila, pero **no debe integrarse tal cual**:
las siete regresiones independientes de la auditoría fallan contra él (7/7) y
pasan contra esta rama.

## HISTÓRICO — sesión 12: Hito 6B, prototipo de Grok sin corregir

> **Procedencia, no estado actual.** Lo que sigue describe el prototipo tal y
> como llegó. Se conservó como commit `e6288f2` y HOY está corregido e integrado
> en `main` (ver sesión 13). Los identificadores
> `hito-6b-adaptive-decision-sessions`, la etiqueta `source-f6152c47` y el commit
> `d6b003c` pertenecen al **repositorio ajeno de Grok**: no existen aquí y no
> deben buscarse en este historial.

- **La sesión envuelve el diario**, no lo duplica: una sola próxima acción
  (`journal_state.primary_entry_id` + `active_session_id`). Proponer una nueva
  cierra la anterior en la misma transacción; una sesión abierta bloquea otro
  paso principal.
- **Freno determinista** (`evaluateSessionGate`): incógnita crítica +
  irreversible pide evidencia; restricción core ocupa el hueco 1 y no se
  sustituye por la siguiente puntuada; pieza a sustituir pronto o presupuesto
  superado (misma moneda, coste conocido) pausa para conservar el recurso.
- **Resultado inesperado valioso** se protege y cambia el plan. **Descarte
  causal** deja una condición de reapertura; evidencia compatible → candidata,
  nunca un hecho demostrado. **Lo subjetivo no se trata como medición.**
- **Huella de personaje**: si cambian nivel, liga, parche o equipo, la sesión
  no se reutiliza en silencio (409 + confirmación). *(Corregido en la sesión 13:
  la huella original solo miraba los IDS de los objetos, así que editar una pieza
  sin cambiar su id no se detectaba.)*
- **SQLite aditivo**: `decision_sessions`, `decision_session_events` (máx. 40,
  `idempotency_key` UNIQUE) y columna `active_session_id`. Los payloads 5A/5B
  no se reescriben. *(Corregido en la sesión 13: el tope de 40 impedía también
  cerrar la sesión, y `MAX_SESSIONS_PER_CHARACTER` no se aplicaba.)*
- **Revisión e idempotencia**: `journalRevision` forma parte del digest de
  sesión; un 409 `memoria-diario-obsoleta` retira la acción visible y recarga.
  Reintentar la misma clave no duplica el evento.
- **Interfaz «Comprobar una decisión»** en español, sin jerga interna. Desde
  una recomendación, «Comprobar esto». `session_gate` no se guarda como compra
  ni se exporta al `.build`.
- **Sin LLM, sin crafts inventados, sin precios nuevos.**
- Verificado en esta máquina: `tsc -b` 0 errores, ESLint 0 errores,
  **230/230** tests, build OK, smokes de navegador: sesión **26/26**, diario
  **58/58**, mentor **68/68**, equipo **70/70**, flujo principal **20/20**
  (producción + Strict Mode). Capturas en
  `docs/screenshots/sesion-*.png`.
- Detalle en `docs/HITO_6B.md` y `docs/PLAN_6B.md`.

## Sesión 11 — Hito 6A: primera conversación real con el mentor

Trabajo hecho en la rama `hito-6a-conversational-mentor` (worktree aislado).
**Ya integrado en `main`** (fast-forward a `f6152c4`).

- **«Habla con tu mentor»** (hoy dentro del área **Mentor**; entonces era la
  sección numerada 5): campo de texto, sugerencias, turnos
  diferenciados, estado de carga, respuesta estructurada con fuentes, confianza
  y «falta por verificar», y botón para guardar la próxima acción en el diario.
- **Basado en reglas, sin IA generativa**: un clasificador de intención pequeño y
  explícito (`next_improvement`, `explain_priority`, `unsupported`). Sin LLM y sin
  texto inventado; las respuestas son plantillas rellenadas con datos del motor y
  del diario. **La decisión procede del motor, no de generación libre**: esa es la
  afirmación verificable del hito.
- **Sí puede haber red**: cuando el motor necesita precios, el mentor usa el mismo
  servicio documentado de poe.ninja que el resto de la app (desde el servidor, con
  caché SQLite y ETag). Por eso ya **no se afirma «sin red» ni «misma respuesta
  palabra por palabra»**: `generatedAt` y el `retrievedAt` de las fuentes cambian,
  y si cambian precios o diario el motor puede priorizar otra decisión.
- **Presentación humana**: la respuesta se lee primero como diagnóstico, única
  próxima acción y confianza (en español; nunca `high`/`medium`/`low`). Los
  valores internos (`next_improvement`, `explain_priority`, `calculation`, `user`,
  versión del motor y fecha técnica) no se muestran por defecto; fuentes, fecha,
  motor y lo no verificado siguen accesibles en «Ver evidencia y limitaciones»
  (`<details>` nativo, se abre con teclado). El contrato estructurado y la
  trazabilidad del backend no cambian.
- **Recuperación del primer 409**: ante `memoria-diario-obsoleta` la interfaz
  reinicia limpiamente el hilo y recarga el diario, así que al reintentar no hay
  pregunta duplicada, respuesta antigua ni acción guardable obsoleta. Antes, en la
  PRIMERA consulta el hilo aún no tenía huella de inputs y la pregunta recién
  fallada se quedaba pintada. Regresión que empieza con el hilo vacío en
  `tests/unit/mentorThread.test.ts`.
- **Desplazamiento del chat**: al añadir pregunta, respuesta o estado de carga, el
  contenedor del hilo va al último turno sin mover la página entera, y respeta
  `prefers-reduced-motion`.
- **Reutiliza el motor**: con una acción activa el mentor RECUERDA ese paso y no
  consulta precios; una memoria completada se reconcilia como `profile_sync`; el
  resultado libre del jugador sigue siendo evidencia, nunca estadística.
- **`POST /api/mentor/query`** con las mismas protecciones que
  `/api/recommendations`: memoria autoritativa del servidor, 409 por revisión
  obsoleta y segunda comprobación tras la espera asíncrona.
- **Limitación declarada**: la conversación NO se persiste. Vive en memoria de la
  interfaz y se descarta al cambiar personaje, build objetivo, presupuesto,
  objetivo, liga, parche o revisión del diario.
- Verificado: `tsc -b` 0 errores, ESLint 0 errores, **181/181** tests, build OK,
  smoke del mentor **48/48** (24 × producción + desarrollo con Strict Mode) y sin
  regresiones en los smokes previos (principal, equipo 35/35, diario 29/29).
- Detalle completo en `docs/HITO_6A.md`.

## Sesión 10 — Hito 5B: la memoria influye en la siguiente decisión

- El servidor proyecta el Character Journal a un contexto autoritativo de
  tamaño acotado: acción principal y hasta diez resultados de recomendaciones.
- Una acción `active`/`waiting_result` detiene el motor antes de precios: cero
  tareas paralelas. Si una recomendación completada sigue activándose, se
  reemplaza por una única acción `profile_sync`; el resultado libre se conserva
  como evidencia, pero jamás se analiza como estadísticas o mods.
- `journalRevision` detecta UI obsoleta; una segunda lectura después de precios
  y explainer cierra la carrera entre pestañas (409 antes de responder). La UI
  reconoce ese 409, retira inmediatamente las decisiones obsoletas y recarga el
  diario en vez de quedar atascada.
- Lectura del motor indexada y acotada en SQLite. Migración aditiva de entradas
  5A: añade metadatos, conserva los payloads y no borra filas (regresión sobre
  esquema antiguo). Solo resultados `game_change` ocupan las diez plazas: las
  reconciliaciones `profile_sync` no pueden expulsar la memoria original.
- Acciones `profile_sync` no muestran el control de exportación. La selección
  frontend las descarta y el exportador vuelve a validarlo: ids desconocidos se
  omiten y se declaran en `skippedUnverified`, nunca aparecen crudos en `.build`.
- Dos rondas de auditoría independiente sobre el commit inicial `0052e06` y
  sus correcciones: cerradas la carrera entre pestañas, la evicción de memoria,
  la invalidación tardía del 409 y la frontera de títulos persistentes.
- Verificado tras las correcciones: TypeScript 0 errores, **147/147 tests** (13
  archivos), ESLint 0 errores, build de producción correcto y **58/58**
  comprobaciones de navegador 5A/5B en producción + Strict Mode.

## Sesión 9 — Hito 5A: memoria persistente del mentor

- Diario SQLite por personaje para decisiones, experimentos, crafts, hitos y
  notas; una sola próxima acción principal.
- Separación real entre acción pendiente, ejecutada/esperando resultado y
  completada. Una acción no puede completarse sin resultado del jugador.
- Recomendaciones convertibles en decisiones auditables con snapshot, fuentes,
  coste, riesgo, confianza, parche, presupuesto y objetivo del momento.
- Interfaz «Mentor del personaje», historial y seguimiento manual; persistencia
  tras recargar y responsive comprobado en 320/360/390 px.

## Sesión 8 — consistencia y reproducibilidad

- **Aviso de importación actualizado**: ya no afirma que las pasivas «no son resolubles». El aviso vigente dice que las pasivas se resuelven con el registro oficial cuando el id existe, que los ids desconocidos permanecen visibles y marcados como no verificados, y que los nombres de skills/support skills todavía no se resuelven por falta de fuente incorporada. Regresión que falla con el mensaje antiguo.
- **Reproducibilidad byte a byte**: `.gitattributes` fija `eol=lf` para `server/data/passives/*.json`; regenerar el registro desde un checkout limpio de Windows produce exactamente los mismos bytes y deja `git status` limpio (verificado, no solo comparación semántica).
- **Ascendencias parcialmente conocidas**: cuando la fuente no publica el nombre pero sí la clase (Ranger2, Druid3), la UI muestra ambas realidades por separado — «Nombre no verificado · clase Ranger (Ranger2)» — vía `describeAscendancy` (helper puro con tests).
- Este documento revisado por completo: las secciones antiguas quedan marcadas como históricas y los supuestos/pendientes reflejan el estado real tras el Hito 4A.

## Sesión 7 — Hito 4A: resolución de pasivas y ascendencias (export oficial de GGG)

- **Registro interno** derivado solo del export oficial `grindinggear/poe2-skilltree-export`,
  commit fijado `1e9eb2d8c1946398c3aaaacfbaead5c75c0d1fa6`, SHA-256 del `data.json`
  `f83c94ce7b09f2bfc5b3b1d63523c2ab3d2582d0e964f6aeec34b8b0390abcfe` (5 141 380 bytes),
  obtenido el 2026-08-20. Datos de Grinding Gear Games; **licencia explícita: no encontrada**.
  4912 nodos, 12 clases y 25 ascendencias; sin sprites ni recursos gráficos.
- **El parche no se atribuye a la fuente**: el commit de origen se etiqueta a sí mismo como
  `0.5.2`; nosotros solo declaramos `testedAgainstPatch: "0.5.4f"` (compatibilidad probada).
  Por eso el artefacto se llama `passiveRegistry.1e9eb2d8.json` y no `passives.0.5.4f.json`.
- **Proceso offline y reproducible** (`scripts/build-passive-registry.ts`): verifica el
  SHA-256 de la revisión fijada, valida entrada y salida con esquemas estrictos y falla
  con mensaje claro si la estructura oficial cambia. En runtime no hay red ni descargas.
- **Servicio de solo lectura** (`server/registry/passiveRegistry.ts`): id de pasiva → nombre
  inglés verificado; ascendancy id → nombre y clase; desconocido → explícitamente no
  verificado con el id crudo siempre disponible. El nombre nunca se deduce del id.
- **Integración**: `POST /import/build` devuelve `resolution` en PARALELO al plan; el `.build`
  crudo no se toca (test: importar, resolver y reexportar Titan Warrior es verbatim).
  Titan Warrior resuelve **34/34** pasivas y `Warrior1` → **Titan** (clase Warrior). La UI
  muestra nombre inglés + id, y los desconocidos como «No verificado».
- **Aviso obligatorio** visible en la interfaz: «This product isn't affiliated with or
  endorsed by Grinding Gear Games in any way.»
- Corregido de paso el desfase de `MAX_MARKUP_TAG_LENGTH`: una etiqueta de exactamente 32
  caracteres ya respeta el límite documentado (prueba de frontera 32/33 que fallaba antes).
- Verificado: `tsc -b` 0 errores, **98/98** tests, ESLint 0 errores, build OK, 20/20 smoke
  (prod+dev) y 14/14 comprobaciones de navegador del flujo del registro.
- Limitaciones: la fuente publica algunas ascendencias sin nombre (`Ranger2`, `Druid3`) y se
  marcan como no verificadas; no se resuelven gemas ni supports (fuera de alcance).

## Sesión 5 — validación manual dentro del juego y corrección de markup

- **Validación manual en PoE2 real (2026-08-20)**: el propietario importó en el juego un `.build` exportado por Exile Copilot (plan Titan Warrior con mejora aplicada incrustada). PoE2 importó correctamente el nombre y la ascendencia, las **34 pasivas con sus rutas**, las **4 habilidades** (Boneshatter, Earthquake, Infernal Cry, Shockwave Totem) y los **9 huecos de equipo**, incluido el texto añadido al anillo «Mejora planificada: Cubrir resistencias elementales hasta el cap». Evidencia: [árbol de pasivas](docs/screenshots/ingame-arbol-pasivas.jpg), [habilidades](docs/screenshots/ingame-habilidades.jpg), [equipo con la mejora incrustada](docs/screenshots/ingame-equipo-mejora-incrustada.jpg). Esto es una validación **manual y puntual de ese archivo**, distinta de las pruebas automatizadas (que validan contra el esquema documentado); el resto de exports siguen siendo «válidos contra el esquema», no «probados en el juego».
- **Corregido**: las recomendaciones de la regla «Acercarse a la build de referencia» mostraban restos del markup oficial («Increased Armour}; …»). Causa: las pistas de los inventory_slots se limpiaban línea a línea, pero los bloques `<tag>{...}` del markup GGG abren y cierran en líneas distintas, así que la llave de cierre sobrevivía en la última línea del bloque. Ahora el markup se elimina sobre el texto completo antes de trocearlo, con un parser de **un solo recorrido O(n)** (pila que distingue la llave de un wrapper de una llave literal); las llaves/paréntesis de texto legítimo fuera de un wrapper no se tocan y un wrapper sin cerrar se conserva verbatim. La primera versión del arreglo era iterativa y cuadrática: medida en esta máquina, 50 000 niveles anidados (342 kB, dentro del límite de 2 MB de la API) bloqueaban el servidor 25 960 ms, frente a 3,5 ms con el parser actual y salida idéntica. Se limitan además las pistas incorporadas a una recomendación (`MAX_PLAN_HINTS` 40, `MAX_LISTED_GAPS` 12, con el resto declarado por número). Regresiones en `tests/unit/auditRegressions.test.ts` (fallaban antes de cada arreglo). 80/80 tests.

## Sesión 4 — auditoría independiente y correcciones

Las afirmaciones de la sesión 3 se verificaron de forma independiente: `tsc -b` (0 errores), 65/65 tests, ESLint 0 errores, build OK y 20/20 comprobaciones de navegador (Edge, prod + dev) reproducidas en esta sesión. El esquema `.build` se contrastó contra la documentación oficial de GGG (pathofexile.com/developer/docs/game), los endpoints de poe.ninja contra poe.ninja/docs/api, el hilo «0.5.4f Hotfix» (Stacey_GGG) contra el foro oficial y el fixture PoB2 contra la issue #2412 (coincide byte a byte). No se encontraron P0/P1. Defectos P2 corregidos (72/72 tests tras las correcciones, con regresiones que fallaban antes de cada arreglo):

- **`level_interval`**: la doc oficial lo define como `?(array of uint, or uint)`; el esquema solo aceptaba tuplas de exactamente 2 y rechazaba archivos válidos según la doc. Ahora acepta uint o array de uint.
- **Campos no documentados**: un `.build` con campos fuera del esquema v1 los perdía en silencio al importar/reexportar. Ahora los esquemas son *loose*: se conservan tal cual, el importador los declara en warnings y la reexportación los preserva (incluidos los del objeto raíz).
- **`primaryCurrency`**: con una moneda primaria no reconocida la API respondía `"exalted"` (un desconocido convertido en afirmación concreta). Ahora responde `null`; los quotes individuales conservan su nota «No verificado».
- **Mejoras aplicadas obsoletas**: una recomendación marcada en una generación anterior (ya invalidada) podía colarse en el `.build` exportado. Ahora las marcas se reinician con cada resultado y la exportación filtra contra el resultado vigente.
- **Mutación del plan al exportar**: `exportGggBuild` mutaba el plan de entrada al anotar la mejora de skill (copia superficial); dos exports con el mismo objeto duplicaban texto. Corregido con copia por elemento.
- Menor: el placeholder de importación aún mostraba el formato propietario eliminado (`{"formatVersion": 1}`).

Notas sin cambio de código: la afirmación de fidelidad de la sesión 3 se apoyaba en el fixture oficial Titan Warrior, que **no contiene** `level_interval`, `weapon_set` ni coordenadas; ahora existe un test con un plan sintético que ejercita todos los campos documentados. `meta.archetypes` sigue hardcodeado y sin uso en el frontend (P3). `demoMercenary.build` no lo usa ningún código ni test (P3). La reproducibilidad depende de Node 24+ en PATH (en esta máquina solo existe el Node 24.15 empaquetado con kimi-desktop).

## HISTÓRICO — sesión 3: qué funcionaba entonces

> Redactado en la sesión 3 y conservado como historial. Varios puntos han
> evolucionado después: la sesión 5 añadió una validación manual dentro del
> juego y la sesión 7 incorporó el registro oficial de pasivas. El estado
> vigente es el de las secciones de sesión más reciente y «Pruebas ejecutadas».

- **Integridad del repo**: `server/data/patches.json` estaba ignorado por un patrón `.gitignore` demasiado amplio (`data`); corregido a `/data/` y versionado. Verificado con `git ls-files` y con clon limpio (ver «Pruebas ejecutadas»).
- **Separación personaje actual vs plan `.build`**: un `.build` oficial de GGG ya NO se convierte en snapshot del personaje. Importarlo crea un **BuildTargetPlan** (sección «Build objetivo», con aviso «no es tu personaje actual») y conserva el objeto oficial crudo. El motor nunca ejecuta reglas de equipo/quality/mods/resistencias sobre inventory_slots del planner. Eliminado el `archetype: "mercenary-crossbow"` hardcodeado. Test obligatorio incluido: importar «Titan Warrior» nunca menciona ballesta, quality ni «0 mods».
- **Fidelidad del `.build`**: importar y reexportar conserva `level_interval`, `weapon_set`, `additional_text` (con markup), coordenadas `slot_x/slot_y`, `author` y `link` (tests con `toEqual` sobre el fixture oficial y, desde la sesión 4, sobre un plan sintético que ejercita todos los campos documentados y los no documentados). Las pérdidas se listan expresamente en el informe. `ascendancyId` (id oficial) separado del nombre visible. `unique_name` solo se exporta si es verificada (por defecto no, y se reporta). En la UI y docs: «válido contra el esquema GGG», nunca «probado en el juego».
- **Persistencia**: restauración corregida para React Strict Mode (efecto idempotente, no se queda en «Restaurando…»); el id solo se guarda en localStorage tras un `POST /api/character` exitoso (perfil real en SQLite). Verificado en navegador, en producción y desarrollo: guardar vida=2150 → recargar → exactamente vida=2150, y la respuesta de guardado se comprueba (200 + `profile.life === 2150`).
- **Recomendaciones aplicadas**: el servidor ya no las descarta — se incrustan como texto legible en `description` («Mejoras planificadas: 1) …») y en `additional_text` del slot/skill relacionado. Test que comprueba el contenido del archivo, no solo el HTTP 200.
- **Mercado**: `verified: true` exige moneda primaria reconocida (test de primaria desconocida); las tasas transportan origen (`live`/`cache-fresh`/`cache-stale`/`fixture`) y verificación; tasas fixture/stale nunca justifican afirmar que una compra entra en el presupuesto (test de quote live + rates stale).
- **Datos**: parche local actualizado a `content: 0.5.4`, `hotfix: f`, `asOf: 2026-08-12`, fuente: hilo oficial «0.5.4f Hotfix» (Stacey_GGG, foro de parches de pathofexile.com) — verificado en el foro oficial en esta sesión.
- **Fixture PoB2 real**: los tests del adaptador PoB usan un código REAL extraído de la issue #2412 del repo PathOfBuilding-PoE2 (decodifica a XML `PathOfBuilding2` de 12 929 bytes, clase Ranger), con `PROVENANCE.txt`; los payloads sintéticos solo cubren los límites de seguridad.
- `docs/PLAN.md` reescrito: ya no documenta el formato propietario eliminado.

## Cómo abrir la aplicación

```bash
cd exile-copilot
npm install
npm run dev    # http://localhost:7100 (frontend + API en un solo servidor)
```

## Cómo probar el flujo principal

Manual: «Cargar ejemplo» → editar vida → «Guardar correcciones» → presupuesto → «Generar recomendaciones» → marcar una → «Descargar .build» → ver informe → recargar (el personaje vuelve con la vida exacta). Importar un `.build` oficial lo añade como build objetivo (plan), no como personaje.

Automatizada (navegador real, Edge):

```bash
npm run build
npm run test:browser        # producción
node scripts/browser-smoke.mjs --all   # producción + desarrollo (Strict Mode)
```

## Capturas

`docs/screenshots/flujo-prod.png` y `flujo-dev.png` (smoke automatizado, regeneradas en cada ejecución) e `ingame-*.jpg` (validación manual dentro del juego, sesión 5).

## HISTÓRICO — decisiones tomadas (sesión 3)

- El `.build` oficial se trata siempre como PLAN: la importación aterriza en «Build objetivo»; solo los códigos PoB rellenan un personaje parcial.
- Fidelidad vía conservación del objeto crudo en `target.plan`: la reexportación parte del plan original y declara cualquier pérdida.
- Las mejoras aplicadas se exportan como texto legible (description/additional_text), no como datos estructurados inventados.
- La restauración del personaje hace una doble petición GET bajo Strict Mode (idempotente); se priorizó corrección sobre ahorro.

## Supuestos (vigentes)

- Adaptador GGG OAuth desactivado por flag (`GGG_OAUTH_ENABLED=false`). No hemos verificado el estado actual del proceso de solicitudes OAuth de GGG; activarlo exigiría comprobarlo primero.
- Pasivas y ascendencias SÍ se resuelven a su nombre inglés oficial con el registro derivado del export de GGG (Hito 4A); los ids fuera del registro se muestran como «No verificado». Sigue sin existir fuente incorporada para `BaseItemTypes`: los nombres de skills y support skills no se resuelven todavía.
- PoB/POBb.in: adaptador básico (Hito 6 pendiente).

## HISTÓRICO — pruebas ejecutadas en la sesión 8 (2026-08-20)

- `npx tsc -b` → 0 errores.
- `npx vitest run` → **9 archivos, 102/102 verdes**.
- `npm run lint` → 0 errores.
- `npx vite build` → OK (~151 kB gzip).
- `node scripts/browser-smoke.mjs --all` → **20/20** (10 comprobaciones en producción + 10 en desarrollo con Strict Mode).
- Flujo del registro en navegador (plan Titan Warrior): resolución 34/34 visible, nombre inglés + id, ascendencia Titan, procedencia y aviso de GGG.
- Verificación desde **checkout limpio**: ver sección siguiente.

## Verificación desde checkout limpio

Realizada sobre un `git clone` del commit final (no sobre el working tree): `npm install` → `npx tsc -b` (0 errores) → `npx vitest run` (102/102) → `npm run lint` (0 errores) → `npx vite build` (OK). Además, regenerar el registro de pasivas desde el `data.json` fijado (`npx tsx scripts/build-passive-registry.ts --input …`) produce **exactamente los mismos bytes** que el artefacto versionado y deja `git status` limpio, gracias a la regla `eol=lf` de `.gitattributes`. Clon eliminado tras la verificación; sin procesos residuales.

## Funciones incompletas

- Resolución de skills y support skills (`BaseItemTypes`): sin fuente incorporada; sus nombres siguen sin resolverse. (La resolución de PassiveSkills y ascendencias está TERMINADA — Hito 4A.)
- Adaptador PoB: extracción básica. POBb.in: sin vía pública documentada.
- Explicador LLM: stub desactivado.

## Errores conocidos

- Precios de objetos raros: «No verificado» (poe.ninja solo cotiza únicos y divisa).
- Bundle JS > 500 kB (aviso de Vite sin impacto funcional).

## Riesgos legales o de datos

- Solo API económica documentada de poe.ninja desde servidor, con User-Agent, caché/ETag. Sin scraping ni endpoints internos. Cero secretos en el repo.

## Próximo paso recomendado

## Sesión 20 — mentor contextual persistente

El mentor deja de vivir únicamente dentro del acordeón de conversación. Un
panel flotante acompaña ahora las dos áreas del producto y cambia de contexto
cuando el jugador:

- abre una pieza del equipo;
- cambia entre expediente y plan/mercado;
- modifica objetivo, presupuesto, moneda o liga;
- genera recomendaciones, consulta mercado o guarda un próximo paso;
- inicia una sesión de decisión.

Cada reacción inmediata se deriva de datos estructurados ya presentes en la
aplicación y no consume IA. «Analizar este contexto» envía una pregunta acotada
al proveedor supervisado existente; la respuesta vuelve al propio panel y queda
también en la conversación completa. No se escucha cada clic del DOM y no se
añaden hechos, precios, mods ni acciones fuera del motor.

Validación: `tsc -b`, ESLint, build y **305/305** pruebas; recorrido real en
navegador sobre el perfil Demo Gemling comprobado para cambio de área,
inspección de `Doom Song`, respuesta real de Groq y salto al historial.

Hitos 5A, 5B, 6A y 6B están **integrados en `main`** (`dd671178`), y la
microcorrección posterior al 6B —contrato de `goal`, aislamiento de SQLite en los
smokes y esta puesta al día documental— está **terminada**.

Lo siguiente es el **rediseño visual «Expediente del personaje»**: el área
Mentor apila hoy diario, sesión, conversación y recomendaciones, y esa pila pide
una jerarquía mejor. Después, **Copilot conversacional v1**: historial
persistente de la conversación (hoy el hilo vive solo en memoria de la
interfaz), reconocimiento de intención más amplio y seguimiento de crafts paso a
paso — manteniendo la regla de que la decisión, la próxima acción, las fuentes,
la confianza y lo no verificado salgan siempre del motor y del diario, aunque
algún día se añada un LLM para redactar.

La resolución de `BaseItemTypes` (nombres de skills y support skills) continúa
pendiente, pero no bloquea nada de lo anterior.

## Sesión 28 — contrato de protección de modificadores

El preflight de Monedas, Essences y Alloys permite declarar qué modificadores
explícitos son indispensables antes de gastar. `shared/craftingProtection.ts`
evalúa la protección usando solo el snapshot real y el mecanismo de retirada
declarado: retirada aleatoria = riesgo posible, retirada elegida = segura si
existe una alternativa no protegida, retirada desconocida = faltan datos y
pérdida inevitable = bloqueo. No se presentan probabilidades inventadas.

La intención se conserva en `DecisionSession.craftingExperiment` y la
comparación posterior informa por separado si los modificadores protegidos se
mantuvieron, se perdieron o ya no pueden verificarse. Una pérdida protegida no
se oculta aunque el cambio estructural de la moneda sea correcto. La selección
queda acotada al objeto y a sus ids de modificadores vigentes para impedir que
una protección obsoleta se reutilice después de actualizar el snapshot.

Validación final: TypeScript y ESLint sin errores, build de producción correcto,
**429/429** pruebas y **166/166** comprobaciones del recorrido de equipo y
Crafting en producción y desarrollo/Strict Mode. Los puertos temporales 7188 y
7189 quedaron libres.

## Sesión 29 — Crafting orientado a una decisión

Se aplicaron los hallazgos verificables de la auditoría visual sin alterar el
motor. El banco sigue la jerarquía pieza → estado → siguiente paso → método: la
pieza seleccionada muestra un semáforo textual, una lectura parcial ofrece
volver directamente al importador de objetos y Monedas, Essences y Alloys se
presentan como controles compactos. La información de conocimiento,
probabilidades y límites vive ahora en el mismo bloque de evidencia, en lugar
de tres superficies repetidas.

Se corrigió el crecimiento horizontal del carrusel con `min-w-0`/`max-w-full`
y se añadió una regresión exacta a 375 px. El guardado de memoria dejó de
competir visualmente con «Generar recomendaciones»: conserva su función, pero
usa jerarquía secundaria. No se modificó `ContextualMentor`, porque la auditoría
lo describía como estático pero el código vigente ya lo posicionaba fijo.

Validación: TypeScript y ESLint sin errores, build de producción correcto,
**429/429** pruebas y **168/168** comprobaciones reales en producción y
desarrollo/Strict Mode. Crafting mide 375/375 px sin desbordamiento y su estado
inicial se mantiene por debajo de 2,5 pantallas móviles.

## Sesión 30 — Crafting utilizable en menos de un minuto

Se cerró el recorrido principal alrededor del motor sin cambiar sus reglas. Un
objeto suelto puede preparar una sesión en el mismo gesto: el perfil mínimo se
persiste, se recarga su diario y el editor completo no aparece. La acción
compatible queda visible por delante de las bloqueadas; las monedas que solo
añaden y las Essences sin retirada ya no muestran protección de afijos.

Al crear la sesión, el foco y el desplazamiento llegan al caso de Crafting. El
planificador anterior permanece montado para conservar borradores, pero queda
oculto mientras la sesión está activa. La sesión específica se reduce a tres
etapas visibles —antes de gastar, pegar resultado y decidir— y elimina badges,
restricciones, próxima acción y evidencia avanzada que duplicaban el mismo
mensaje. Una comparación confirmada deja en pantalla solo el cambio y las
decisiones «Sí, me sirve», «No era lo que buscaba» y «Parar por ahora».

Validación: TypeScript y ESLint sin errores, build de producción correcta,
**429/429** pruebas y **184/184** comprobaciones de navegador en producción y
desarrollo/Strict Mode. El recorrido desde la bienvenida usa ocho interacciones
y cubre también un fallo controlado del primer autoguardado: conserva objeto,
objetivo y confirmaciones, no abre el editor ni crea una sesión fantasma, y el
mismo botón reintenta con éxito. Además, se recorrió una instancia temporal con
la ballesta real: sesión visible y enfocada, y planificador oculto. Los puertos
y las bases SQLite temporales quedaron cerrados y eliminados al terminar.

## Sesión 31 — el resultado responde al objetivo del jugador

El preflight de Monedas, Essences y Alloys conserva ahora dos capas del
objetivo: una categoría explícita —daño, defensa, atributos, velocidad,
habilidades u otro— y la descripción libre del jugador. La categoría es
opcional en el contrato persistido para que las sesiones anteriores sigan
siendo válidas.

Después del craft, `shared/craftingGoal.ts` compara exclusivamente las
etiquetas literales de los modificadores añadidos con la categoría elegida.
Devuelve tres estados honestos: señal directa, sin señal directa o datos
insuficientes. No analiza nombres ni texto del afijo, no calcula utilidad y
explica que una ausencia de señal puede esconder una interacción indirecta.
La pregunta «¿me sirve?» y la decisión final permanecen en manos del jugador.

Validación: TypeScript y ESLint sin errores, build de producción correcto,
**440/440** pruebas y **190/190** comprobaciones reales del flujo de equipo y
Crafting en producción y desarrollo/Strict Mode. La regresión de navegador
selecciona «Daño», importa un resultado etiquetado por el juego como «Daño,
Ataque» y exige que aparezca la señal directa antes de la valoración humana.

## Sesión 32 — lectura contextual del resultado

`shared/craftingCharacterContext.ts` convierte la comparación ya observada en
una decisión contextual conservadora: **candidato**, **revisar** o **detenerse**.
Comprueba el nivel y los atributos frente a los requisitos del resultado,
prioriza cualquier pérdida de modificadores protegidos y puede relacionar una
etiqueta literal de resistencias con resistencias elementales conocidas bajo
75%. También indica si la pieza está realmente vinculada al equipo y si la
categoría del craft coincide de forma inequívoca con el objetivo general
`damage` o `survival`.

No calcula DPS, defensas derivadas, precio ni una nota numérica. Si el craft
añadió o retiró un modificador etiquetado como atributo, invalida el total
anterior para comprobar requisitos en vez de presentar un dato obsoleto como
hecho. La interfaz resume la salida en tres chips y mantiene hechos y límites
plegados bajo «Por qué dice esto» para no volver a llenar la pantalla de texto.

Validación: TypeScript y ESLint sin errores, build de producción correcto,
**445/445** pruebas y **190/190** comprobaciones reales del recorrido de equipo
y Crafting en producción y desarrollo/Strict Mode. Los puertos temporales 7188
y 7189 quedaron libres.

## Sesión 33 — primera impresión, expediente y Mentor

La cabecera se convirtió en una barra compacta de producto: marca, personaje
activo, una sola acción útil y un resumen de parche. La cobertura y el proveedor
del Mentor viven en el desplegable de estado; la música experimental conserva su
acción propia y visible. En 320, 360 y 390 px no hay
desbordamiento horizontal; la mascota conserva su identidad visual con medidas
reales adaptadas a móvil.

La portada explica la promesa antes de pedir datos: añadir personaje, recibir
una prioridad y comprobarla dentro de PoE2. El destino de un `.build` depende de
la intención visible: desde el alta crea un borrador parcial del personaje con
nombre, ascendencia, habilidades y pasivas; desde «Plan y mercado» se conserva
como objetivo. Nunca se inventan nivel, equipo, atributos ni resistencias que el
formato oficial no contiene.

El Mentor dejó el acordeón y ahora forma parte visible del briefing del
expediente. La mascota continúa como acceso contextual al mismo flujo. La
evidencia técnica permanece plegada y la conversación explica una prioridad y
cómo comprobarla en el juego sin presentar a la web como sustituto de PoE2.

Validación: TypeScript y ESLint sin errores, build de producción correcto,
**730/730** pruebas, recorrido principal completo en desarrollo y producción,
y **50/50** comprobaciones dedicadas del Mentor. Las pruebas incluyen la
separación personaje/objetivo, cabecera móvil, foco, recuperación de API,
privacidad, historial y ausencia de peticiones externas del Mentor.

## Sesión 34 — un borrador parcial ya no parece analizable

Se centralizó el umbral mínimo del expediente. Recomendaciones y sesiones de
mejora exigen clase y nivel observados, además de al menos una pieza equipada;
la portada, el caso abierto y la API comparten el mismo contrato. Un `.build`
importado como personaje parcial conserva nombre, ascendencia, pasivas y
habilidades, pero muestra exactamente qué falta y conduce a completar el
expediente en vez de habilitar una recomendación insegura.

El Mentor aplica un umbral contextual: no consulta IA ni genera una prioridad
cuando clase o nivel son de relleno. Sí puede explicar una decisión con un
expediente sin inventario cuando existen identidad y estadísticas realmente
observadas, y mantiene disponibles las explicaciones estructuradas de Crafting,
que no dependen de fingir datos del personaje. La mascota, el chat, la API y el
inicio de sesiones respetan esas mismas barreras.

Validación: TypeScript y ESLint sin errores, **741/741** pruebas y recorrido
completo de navegador en desarrollo. El recorrido incluye el `.build` parcial,
la lista explícita de clase, nivel y equipo pendientes, el bloqueo del Mentor y
de Recomendaciones, y la continuidad del guía de Crafting. El puerto temporal
7198 quedó libre al terminar.

## Sesión 35 — menos texto sin quitar capacidades

La auditoría visual separó información necesaria de contenido prematuro. En
Expediente, el acceso al Mentor queda como una fila compacta y la conversación
se abre bajo demanda; la cabecera y la mascota la despliegan y enfocan
automáticamente. El chat vacío elimina explicaciones repetidas, reduce cuatro
sugerencias equivalentes a dos y usa un campo de una sola línea. La restauración
silenciosa del personaje ya no genera un aviso que tapa la cabecera.

En Plan y mercado, la selección vacía de «10 builds» se resume en una fila y
deja su metodología plegada. Mercado conserva una sola tarea visible y elimina
el estado vacío que repetía las instrucciones de sus propios campos. El
briefing de build objetivo empieza cerrado y se abre cuando el jugador decide
importar o afinar un destino. Crafting no se recortó: su texto visible acompaña
una decisión real y eliminarlo perjudicaría la enseñanza.

Validación: TypeScript y ESLint sin errores, **741/741** pruebas, **50/50**
comprobaciones dedicadas del Mentor y recorrido general completo en navegador.
No hay desbordamiento horizontal, errores de consola ni peticiones externas del
Mentor; los desplegables conservan foco, teclado y recuperación.

## Sesión 36 — el corpus real forma parte del lanzamiento 1.0

La barrera de lanzamiento ya no puede aprobar `item-import` únicamente porque
exista un id de evidencia. `loadItemTextCorpusAudit` abre cada tooltip fuente,
lo vuelve a interpretar y contrasta identidad, rareza, nivel, requisitos,
afijos, estados especiales, diagnóstico y parada esperada. Un manifiesto roto o
un resultado que haya cambiado queda reflejado como fallo reproducible.

`readiness:1.0` exige una copia directa del cliente 1.0, fechada desde el 11 de
diciembre de 2026, para cada idioma soportado (`es` y `en`). Los casos actuales
de 0.5.4f y el formato inglés derivado del foro siguen protegiendo el parser,
pero no pueden desbloquear el futuro lanzamiento. El informe actual permanece
correctamente bloqueado y enumera ambos idiomas pendientes.

Validación: TypeScript y ESLint sin errores, build de producción correcto y
**792/792** pruebas; dentro de ellas pasan las **20/20** pruebas dirigidas del
corpus y del auditor de lanzamiento. La auditoría real de 1.0 muestra el nuevo
bloqueo sin activar datos ni cambiar `DEFAULT_PATCH`.

## Sesión 99 — un expediente guardado ya no puede quedar huérfano

La recuperación del personaje dejó de depender por completo de
`exile-copilot:characterId`. Una ruta privada obtiene únicamente el expediente
más reciente de la sesión anónima propietaria; si la cookie continúa presente,
el navegador repone la referencia local y abre el mismo personaje. El servidor
indexa esa búsqueda por propietario y fecha, y no expone listados ni acepta un
id aportado para descubrir perfiles.

«Empezar de nuevo» conserva su significado mediante una marca local explícita:
recargar no resucita el expediente apartado, pero el botón de recuperación
manual sigue disponible. Las respuestas 404 eliminan referencias obsoletas;
una caída de red o un 5xx ya no lo hacen. En ese caso la interfaz conserva el
id, bloquea el alta falsa, explica que los datos no se han descartado y ofrece
reintentar la misma recuperación.

Validación: TypeScript y ESLint sin errores, build de producción correcto y
**846/846** pruebas. Los recorridos completos de navegador pasaron tanto en
desarrollo/Strict Mode como sobre el artefacto de producción, siempre con bases
temporales: demuestran redescubrimiento sin id local, fallo 503 sin pérdida,
reintento, persistencia intencional de «Empezar de nuevo», recuperación manual,
aislamiento y borrado privado.

## Sesión 100 — varios personajes dejan de ser expedientes inaccesibles

La sesión anónima dispone ahora de un índice privado y paginado de sus
personajes guardados. La API devuelve únicamente resúmenes acotados —id,
nombre, clase, ascendencia, nivel, liga, parche y fecha— y nunca incluye equipo,
notas, diario o conversación. El listado conserva el aislamiento por
propietario y limita cada página para impedir enumeraciones o respuestas
desmedidas.

«Cambiar o empezar de nuevo» abre la bienvenida sin resucitar automáticamente
el personaje apartado. Cuando existen varios, aparece un selector compacto,
cerrado por defecto y adaptable a móvil. El jugador puede recuperar cualquiera
de ellos; cambiar actualiza la identidad activa y vuelve a cargar el diario y el
Mentor correspondientes. El recorrido automatizado demuestra que el siguiente
paso del expediente principal no aparece en el segundo personaje y reaparece al
volver al primero.

Validación: TypeScript y ESLint completos sin errores, build de producción
correcto y **846/846** pruebas. Los recorridos integrales pasaron en desarrollo
y en el artefacto de producción con SQLite temporal, incluyendo paginación,
privacidad del resumen, cambio entre dos personajes, separación de memoria,
recuperación tras fallo temporal, responsive móvil, borrado e inexistencia de
errores de navegador o API. No se hizo commit ni push.

## Archivos importantes

- `README.md`, `docs/PLAN.md`, `docs/HITO_5A.md`, `docs/HITO_5B.md`, `HANDOFF.md`.
- `shared/domain.ts` (snapshot), `shared/gggBuildPlanner.ts` (oficial + BuildTargetPlan), `shared/api.ts`.
- `server/importers/gggBuildImporter.ts` (→ plan), `server/exporters/gggBuildExporter.ts` (fidelidad + informe + mejoras planificadas).
- `server/services/poeninja.ts` (rates con origen/verificación), `server/engine/`, `server/data/patches.json`.
- `server/fixtures/ggg/titanWarrior.build.json` (oficial verbatim), `server/fixtures/pob2/` (código PoB2 real + procedencia), `server/fixtures/demoSnapshot.json`.
- `src/` (frontend, Strict Mode), `scripts/browser-smoke.mjs`, `tests/`.
