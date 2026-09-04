# Roadmap de Exile Copilot

> Estado consolidado: 31 de agosto de 2026. Objetivo público: estar preparado
> para Path of Exile 2 1.0 sin heredar datos ni mecánicas del parche anterior.

## Semana de estabilización · 31 de agosto a 6 de septiembre

- [x] Cerrar una versión candidata local completa: lint, build, **837 pruebas**,
  restauración aislada y recorridos de navegador en desarrollo y producción.
- [x] Alinear las barreras de equipo y diario con la divulgación progresiva:
  las alternativas resumidas se abren y se validan una por una, como las usa
  una persona, sin exigir que todos sus controles saturen la pantalla a la vez.
- [x] Rechazar texto ajeno a un objeto de PoE2 sin crear un objeto fantasma y
  resolver explícitamente una pieza pegada sobre un hueco ocupado: sustituir,
  conservar como extra o cancelar; nunca sobrescribir en silencio.
- [ ] Elegir el alojamiento, proxy HTTPS, volumen persistente y contacto real
  de poe.ninja. La auditoría pública enumera seis bloqueos de configuración y
  no permite confundir el servidor local con una publicación preparada.
  - [x] Preparar un contenedor portable de dos etapas, sin privilegios ni
    secretos, que falla cerrado, usa `/data` como volumen y publica un sondeo de
    disponibilidad. El proxy exacto sigue dependiendo del alojamiento elegido.
  - [x] Comparar Render, Railway y Fly.io contra documentación oficial. Render
    queda recomendado para el primer ensayo por su disco de una sola instancia
    y vigilancia continua; no se ha contratado ni desplegado ningún servicio.
  - [x] Reproducir localmente el ciclo del artefacto público: configuración
    insegura bloqueada, cookie segura, escritura en SQLite, reinicio del proceso
    compilado y recuperación de la misma sesión, expediente y diario.
  - [ ] Ejecutar un ensayo manual de pago en Render: permisos del usuario
    `node`, proxy exacto, cookie segura, persistencia tras reinicio, recuperación
    desde copia detenida y barrera pública con variables reales.
  - [ ] Convertir el ensayo aprobado en `render.yaml`; antes de esa evidencia,
    la configuración automática permanece deliberadamente ausente.
- [ ] Tras las notas de 0.5.5 del 4 de septiembre, revisar cada área y registrar
  solo evidencias y textos observados del cliente real antes de habilitarla.
- [ ] Ejecutar un recorrido humano de incorporación y otro de Crafting junto a
  PoE2; convertir únicamente los bloqueos reproducibles en trabajo de producto.

**Regla de congelación:** una pantalla o flujo cuya barrera completa está verde
no vuelve a rediseñarse por intuición. Solo se reabre por una observación real de
jugador, una incompatibilidad de parche o una prueba reproducible que falle.

## 1. Base ya construida

- [x] Expediente de personaje, paperdoll y separación entre personaje actual y
  plan `.build` oficial de GGG.
- [x] Entrada inicial y cabecera compactas: «Añadir personaje» acepta PoB2 y
  puede convertir un `.build` en borrador parcial explícito; Plan y mercado lo
  conservan como build objetivo sin sobrescribir el personaje actual.
  - [x] Un PoB2 con 1–5 piezas puede recibir orientación basada en sus datos
    observados, pero permanece rotulado como análisis parcial antes y después
    de recomendar; solo desde 6 piezas se presenta como análisis amplio. Este
    umbral es una regla de seguridad del producto, no una mecánica de PoE2.
- [x] Diario persistente, una única acción activa y sesiones de decisión con
  resultado, pausa, reapertura y reconciliación.
  - [x] Guardar una recomendación visible como siguiente paso retira ese lote
    sin fingir que cambiaron el personaje, el objetivo o el presupuesto; una
    invalidación real conserva sus avisos y obliga a regenerar.
- [x] Mentor v4: conversación fundamentada y memoria de ocho turnos durante la
  sesión, invalidada cuando cambia cualquier dato autoritativo.
- [x] Mascota v3: estados visuales, avisos semánticos no repetitivos y alertas
  importantes persistentes hasta que el jugador las atiende.
- [x] Academia de Crafting básica, media y avanzada; ayuda en vivo y taller
  avanzado con contrato, parada, antes/después y recuperación.
  - [x] Medio y Avanzado comparten un contrato pedagógico verificable: pieza,
    objetivo, dos a cuatro decisiones, una única respuesta, explicación,
    acciones dentro de PoE2 y condición de parada. Las pistas solo aparecen
    después de responder para no revelar la solución ni cargar la pantalla.
  - [x] Separar la acción dentro de PoE2 de su confirmación en la web: las
    instrucciones dicen «Dentro de PoE2» y la CTA «Ya lo hice en PoE2»; ninguna
    CTA afirma que Exile Copilot usa la moneda por el jugador.
  - [x] Convertir los recursos avanzados sin evidencia en una parada útil:
    Essence y Alloy indican «No verificado · léelo en PoE2 antes de gastar» en
    lugar de parecer contenido pendiente de implementar.
  - [x] Separar la pausa del descarte al volver de PoE2: «Guardar para seguir más
    tarde» conserva el proyecto y «Descartar esta comprobación» exige confirmar
    que el resultado no actualizará el expediente.
  - [x] Mantener un craft pausado visible y reanudable desde Ayuda en vivo,
    incluso tras recargar; vuelve a la misma pieza, moneda, protecciones y
    comparación pendiente.
  - [x] Presentar los perfiles nacidos de una sola pieza como «Expediente
    provisional», no como un supuesto personaje llamado «Objeto suelto», sin
    invalidar las sesiones antiguas por el cambio de texto.
- [x] Barreras de compatibilidad por parche, procedencia visible y publicación
  bloqueada cuando faltan evidencias.
  - [x] La fecha pública de datos deriva de la evidencia y revisión reales; un
    sondeo nuevo no puede hacer parecer reciente una cobertura antigua.
- [x] Control de música visible en desarrollo y producción, siempre voluntario:
  abrirlo no contacta con terceros y reproducir exige aceptar explícitamente la
  conexión con YouTube. Sigue siendo un prototipo, no una promesa del 1.0.

## 2. Trabajo prioritario antes de PoE2 1.0

- [ ] Probar Crafting junto al juego con recorridos reales de jugador nuevo y
  experto; registrar cada bloqueo, texto confuso y resultado que el importador
  no comprenda.
  - [x] Preparar un informe local, reproducible y voluntario para cada lectura
    incompleta, separando copia, parser, cobertura y mecánica no verificada.
  - [x] Reconocer la estructura avanzada inglesa observada de PoE2 y separar
    un tooltip bien leído con mecánica especial de una copia incompleta: el
    primero ordena no gastar y el segundo sí pide volver a copiar.
  - [x] Reunir las formas observadas en un corpus con procedencia, parche y
    expectativas estructurales; parser, API y navegador reutilizan el mismo
    fixture inglés en lugar de mantener tres copias divergentes.
  - [x] Incorporar hasta cien tooltips directos en un único lote transaccional:
    todas las confirmaciones se contrastan antes de escribir y una muestra
    contradictoria o repetida rechaza el lote completo sin restos parciales.
  - [x] Integrar el corpus en la barrera 1.0: no permite publicar hasta que el
    parser reproduzca copias directas del cliente, posteriores al lanzamiento,
    en español e inglés. Los ejemplos antiguos o derivados no cuentan.
  - [x] Convertir los recorridos manuales en una barrera verificable: 1.0 exige
    informes independientes, posteriores al lanzamiento y sin bloqueos para un
    jugador nuevo y otro experto; una huella alterada no cuenta.
  - [ ] Ejecutar y registrar los recorridos reales junto a PoE2.
- [ ] Ampliar la evidencia de Crafting sin inventar pools, pesos ni
  probabilidades: bases, afijos observados, monedas, Essences y Alloys.
  - [x] Separar visualmente la base reconocida de los campos avanzados que
    todavía faltan y conservar ambos grupos en el informe local reproducible.
  - [x] Sustituir la lista fija de snapshots por un manifiesto validado y un
    alta atómica de hasta cien snapshots por lote. Una entrada inválida,
    contaminada por PoE1 o sin procedencia rechaza el lote completo.
- [x] Conseguir que la ayuda en vivo parta del personaje, objetivo, pieza y
  presupuesto cuando existan, y que declare claramente qué falta cuando no
  puede juzgar el encaje.
  - [x] Una necesidad deducida del expediente o del plan no autoriza una
    moneda sobre una pieza sin señal directa del objetivo. Sin pools ni
    probabilidades verificadas, Ayuda en vivo obliga a no gastar y cambiar de
    pieza; los intentos aleatorios solo nacen de un objetivo explícito del
    jugador.
- [x] Impedir que un `.build` parcial aparezca como personaje listo en
  Recomendaciones, Mentor o el inicio de una sesión; la explicación estructurada
  de Crafting sigue disponible porque no depende de inventar el expediente.
- [ ] Conectar una importación completa del personaje mediante una fuente
  oficial autorizada; hasta entonces el `.build` seguirá siendo un borrador que
  el jugador debe completar con clase, nivel y equipo observado.
  - [x] Recuperar desde códigos Path of Building 2 todos los campos que la
    instantánea incluya: set activo, atributos, resistencias, vida, defensas,
    gemas, pasivas y notas. Se mantienen como datos aportados por el usuario,
    no como sincronización oficial, y un código vacío continúa incompleto.
  - [x] Enseñar dónde obtener el código de Path of Building 2 mediante una
    ayuda plegada en el propio importador: «Import/Export Build → Generate →
    copiar». Incluye el proyecto oficial sin añadir ruido al primer vistazo.
  - [x] Guardar el personaje importado antes de cerrar el alta: una lectura
    parcial conserva sus bloqueos, una lectura completa sobrevive al refresco y
    un fallo de guardado mantiene el código y el personaje anterior para poder
    reintentar sin pérdida de datos ni falso éxito.
  - [x] Redescubrir de forma privada el último expediente cuando se pierde solo
    su id local, sin cruzar visitantes ni deshacer «Empezar de nuevo»; una caída
    temporal conserva la referencia y muestra un reintento en vez de un alta
    falsa o una pantalla vacía.
  - [x] Indexar de forma privada y paginada todos los expedientes de la misma
    sesión, mostrar únicamente resúmenes compactos al cambiar de personaje y
    conservar por separado la identidad, el diario y la memoria del Mentor.
- [ ] Terminar de pulir densidad, navegación, estados interactivos, responsive y
  accesibilidad pantalla por pantalla.
  - [x] Primera impresión, cabecera, portada, briefing visible del Mentor y
    regresión sin desbordamiento a 320/360/390 px.
  - [x] Segunda pasada de densidad: conversación del Mentor, selección vacía de
    builds y objetivo avanzado bajo divulgación progresiva; Mercado conserva la
    única tarea principal de su pantalla y Crafting mantiene sus instrucciones.
  - [x] Barrera reproducible de accesibilidad en portada, alta y Crafting:
    controles con nombre, ids únicos, diálogos titulados y navegación de áreas
    mediante flechas y `Home`; los cierres compartidos se anuncian en español.
  - [x] Portada móvil aligerada: la primera decisión completa cabe a 390 × 844,
    sin perder las tres intenciones ni el acceso fijo a Música.
  - [x] Caso principal conectado con el juego: «Qué comprobar después» empieza
    visible y breve; la evidencia técnica continúa bajo divulgación progresiva.
  - [x] Entrada móvil de Crafting compacta: los tres modos comparten una sola
    franja y la pregunta sobre el objeto aparece en la primera pantalla.
  - [x] Música vuelve a la cabecera global con nombre y estado visibles, sin
    desbordar a 390 ni 640 px ni confundirse con una cuarta área.
  - [x] La cabecera global y Música permanecen visibles al desplazarse; la barra
    de áreas se fija inmediatamente debajo sin taparlas.
  - [x] Las paradas de Crafting que piden revisar abren la pieza real en el
    expediente y recuperan el foco al cerrar; no prometen comparar dos objetos
    sin una candidata separada y la práctica queda excluida.
  - [x] En el expediente con personaje, el equipo aparece antes que la
    conversación completa en móvil; la cabecera conserva el acceso global al
    Mentor y abre el mismo hilo bajo demanda.
  - [x] La mascota conserva su identidad visual, pero su hitbox plegado queda
    limitado a 80 × 90 px hasta 767 px para no interceptar campos de Crafting o
    equipo en anchos móviles e intermedios.
  - [x] Tercera pasada de portada: retirar la explicación repetida en tres
    píldoras, relegar el ejemplo a ayuda secundaria y conservar «Expediente»,
    «Plan» y «Crafting» completos a 640 px sin recorte ni desbordamiento.
- [ ] Decidir el proveedor y alcance definitivo de música antes del despliegue
  público real. El prototipo actual declara YouTube antes de conectar y en el
  diálogo de privacidad, pero no fija todavía derechos, catálogo ni costes.
- [x] Bloquear el arranque público con configuración local o insegura; documentar
  secretos, límites de uso, privacidad, persistencia, copias y recuperación;
  ofrecer borrado irreversible y aislado de los datos del visitante.
  - [x] Exigir que la identidad de poe.ninja contenga un correo o URL real;
    localhost y dominios reservados/de ejemplo no pueden aprobar la publicación.
  - [x] Unificar la comprobación del alojamiento, lint, build, pruebas,
    restauración y navegador en `verify:public`; para 1.0 exigir además
    `verify:public:1.0` antes de admitir tráfico.
  - [x] Separar la auditoría de variables reales de los recorridos locales: la
    barrera conserva el parche, pero nunca hereda SQLite, claves ni modo público.
- [ ] Conectar el alojamiento real, su gestor de secretos, restaurar una copia de
  ensayo y activar monitorización y alertas antes de admitir usuarios reales.
  - [x] Mantener `/health` y `/ready` sin sesión ni límites de visitante, con
    cabeceras de seguridad, respuestas no almacenables y referencias operativas
    propias.
  - [x] Marcar toda respuesta funcional de visitante como privada y no
    almacenable, incluidos errores y límites, para que ningún proxy pueda
    reutilizar expediente, diario o Mentor entre sesiones.
  - [x] Rechazar tráfico funcional que el origen público reciba por HTTP antes
    de emitir la cookie segura; los sondeos siguen disponibles al orquestador.
  - [x] Emitir señales JSON de 429, 500 y respaldo del Mentor correlacionables
    sin guardar IP, cookie, ruta, personaje, objeto, conversación ni mensaje de
    excepción.
  - [x] Automatizar un simulacro local y aislado que prueba integridad,
    expediente, sesión anónima, diario y sesión activa del Mentor después de
    copiar y restaurar SQLite.
  - [ ] Ejecutar la restauración con una copia y volumen del alojamiento elegido.

## 3. Activación específica de PoE2 1.0

### Puente 0.5.5 · 4 de septiembre de 2026

- [x] Registrar el anuncio oficial sin cambiar `DEFAULT_PATCH` ni heredar la
  cobertura de 0.5.4f.
- [x] Mantener importación, Crafting, pasivas y mercado en `review-required`
  hasta disponer de notas y muestras propias de 0.5.5.
- [x] Impedir que el orden del catálogo seleccione un parche anunciado por
  delante del parche operativo configurado.
- [x] Reutilizar la barrera completa de lanzamiento mediante
  `readiness:0.5.5` y `verify:0.5.5`: comprueba publicación, metadatos, corpus,
  recorridos, cinco áreas, pasivas y parche activo sin sustituir el objetivo
  principal 1.0.
- [ ] Tras publicarse las notas, revisar su alcance y capturar textos reales del
  cliente antes de autorizar cada área por separado.
- [ ] Verificar la liga de evento Forbidden Rites y la revisión de Trial of
  Chaos sin presentar al Duelista como clase de 0.5.5: está anunciado para 1.0.

La fecha anunciada no autoriza reutilizar datos de `0.5.4f`. La ficha de 1.0 y
sus cinco áreas ya existen en estado cerrado. Al publicarse 1.0:

1. Sustituir el anuncio por los metadatos publicados y su fuente oficial.
2. Capturar y probar tooltips reales de objetos en los idiomas soportados.
3. Volver a verificar monedas básicas, Essences, Alloys y sus transiciones.
4. Actualizar pasivas, ascendencias, ligas y fuentes de mercado.
5. Mantener Crafting y Mentor bloqueados en cualquier área sin evidencia nueva.
6. Ejecutar la barrera `verify:1.0` y los recorridos manuales de jugador nuevo y
   experto antes de cambiar el parche predeterminado.

El contrato completo está en `docs/POE2-1.0-READINESS.md`.

## 4. Después de estabilizar el núcleo

- [ ] Completar la selección editorial «10 builds destacadas» con fuentes y
  permiso verificables para la liga y parche activos.
  - [x] Contrato, API, pantalla, barrera de parche y acción «Usar como objetivo»
    preparados sin sobrescribir el personaje.
  - [ ] Curar las diez entradas reales; popularidad nunca se tratará como
    sinónimo de «mejor» y no se usarán endpoints internos ni scraping.
- [x] Conversación persistente del Mentor entre sesiones anónimas del mismo
  navegador y personaje, sin convertir al LLM en fuente de verdad.
- [x] Mejor seguimiento de proyectos de Crafting largos: el contrato y hasta
  doce resultados quedan separados por personaje y pieza; los cuatro recientes
  permanecen visibles y los anteriores se abren bajo demanda con resultado,
  fecha, rama, cambios y estado de la línea protegida.
- [ ] Personalización de la mascota: nombre, voz textual, intensidad de avisos y
  preferencias de movimiento.
- [ ] Armario de skins reconocibles de clases o personajes de PoE, únicamente
  si Grinding Gear Games concede autorización escrita para ese uso.
- [ ] Las skins deben conservar la identidad reconocible que busca el jugador;
  no se sustituirán por arquetipos genéricos solo para rellenar el armario.
- [ ] No se extraerán modelos, texturas ni archivos del cliente. Antes de crear
  la capacidad pública se enviarán a GGG mockups, atribución, finalidad y modelo
  de monetización para aprobación.
- [ ] Cosméticos puramente visuales: nunca cambiarán la calidad de las respuestas
  ni otorgarán capacidades superiores al Mentor.

Referencia para la decisión de skins:
<https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy>

## 5. Regla de prioridad

Una mejora entra en el trabajo inmediato solo si aumenta al menos una de estas
capacidades: exactitud, comprensión, seguridad de una decisión, recuperación de
un error o preparación verificable para 1.0. Música, skins y otros cosméticos se
mantienen detrás de la estabilidad de Crafting y de la barrera de publicación.
