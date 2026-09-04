# Barreras de calidad de Exile Copilot

Estas comprobaciones son obligatorias para evitar que una mejora local rompa otro recorrido.

## Después de cada parche

Ejecutar:

```text
npm run verify:patch
```

La barrera solo pasa si demuestra conjuntamente que:

- TypeScript compila sin errores.
- Todas las pruebas unitarias pasan.
- La aplicación arranca con frontend y API en el mismo servidor.
- `/api/health` responde.
- `/api/ready` confirma lectura y escritura reversible de SQLite, metadatos del
  parche y orientación autorizada
  para el modo declarado.
- La bienvenida ofrece sus tres recorridos sin duplicados.
- Se puede crear un personaje, pegar un objeto y cargar el ejemplo.
- El importador principal explica, bajo divulgación progresiva, cómo generar y
  copiar el código de Path of Building 2. La ayuda empieza plegada, distingue
  la autorización oficial de Path of Exile, la importación de árbol/equipo y la
  generación del código, deja claro que Exile Copilot no recibe el token, ofrece la
  descarga directa del instalador oficial de Windows y deja GitHub como enlace
  secundario para la versión portátil u otras descargas.
- Un `.build` pegado desde el alta nunca cierra el lateral ni aterriza al jugador
  en un expediente aparentemente terminado: conserva el borrador, explica que
  el formato es un plan incompleto y abre directamente los campos que faltan.
- Una importación PoB2 con menos de seis piezas nunca aparece como «Listo para
  analizar»: permite orientación parcial si clase y nivel son observados, avisa
  qué alcance tiene y conserva «Diagnóstico parcial» tras generar el consejo.
- La portada, el alta y el guía de Crafting no contienen controles visibles sin
  nombre, identificadores duplicados ni diálogos sin título; las tres áreas se
  recorren con flechas y `Home` desde el teclado.
- La mascota abre y cierra su propio mentor contextual.
- «Abrir Mentor» desde la cabecera abre la conversación completa y coloca el
  foco en su pregunta; no basta con navegar al área que la contiene.
- Una comprobación iniciada desde un ejemplo sin guardar muestra una
  confirmación breve de memoria y continúa al guardarlo, sin obligar a recorrer
  el editor completo del personaje.
- Mercado no consulta nombres de objetos raros como si poe.ninja pudiera
  valorarlos individualmente; la reutilización del equipo se limita a únicos.
- Crafting abre sus tres recorridos sin recuperar el cockpit eliminado.
- «No lo sé» puede señalar una carencia medible del personaje, pero nunca
  convertirla en una recomendación de moneda sobre una pieza sin una línea
  reconocible del objetivo: debe ofrecer únicamente no gastar o cambiar de
  pieza.
- El corpus versionado vuelve a interpretar cada forma de tooltip observada y
  conserva identidad, ranura, afijos, estados especiales, procedencia y parada
  esperada. Una copia directa nueva se incorpora con `record:item-sample`, solo
  después de contrastar la lectura con campos confirmados de forma
  independiente; se añade una sola vez y alimenta parser, API y navegador.
- Cada capacidad habilitada resuelve sus `evidenceIds` a artefactos íntegros de
  su propia área. `covered` exige el parche exacto; `limited` puede declarar
  versión desconocida, pero nunca reutilizar una evidencia que afirma otro
  parche. Las nuevas evidencias se incorporan con `record:evidence`: el recibo
  y su fuente deben conservar por separado sus huellas. Una incoherencia rebaja
  solo esa capacidad a `review-required`.
- Guardar, recomendar, exportar y restaurar siguen funcionando.
- Un expediente abierto directamente, sin historial de áreas, muestra
  «Volver a personajes», regresa a la selección y permite recuperar el mismo
  perfil sin borrarlo ni perder su memoria.
- Convertir una recomendación en el siguiente paso no muestra «Tus datos
  cambiaron» ni pide regenerar: esa transición normal se distingue de una
  invalidación real por personaje, objetivo, presupuesto o memoria externa.
- No aparecen errores de navegador, peticiones API fallidas ni recursos 4xx/5xx.
- La prueba usa una base temporal y nunca toca los datos reales del usuario.

## Antes de cerrar una versión candidata

Ejecutar:

```text
npm run verify:release
```

Además de la barrera anterior, construye la versión de producción y recorre en desarrollo y producción los flujos especializados de equipo, mentor, academia y coach de Crafting.

También ejecuta ESLint antes de compilar: una ruta verde en navegador no puede
ocultar código estáticamente inválido o abandonado.

La comprobación de producción también exige que:

- Crafting no forme parte de la descarga inicial y se cargue al entrar.
- Editor, plan y mercado conserven su foco accesible aunque sus módulos se carguen bajo demanda.
- El HTML se revalide y los assets con hash usen caché inmutable.
- Ningún paquete JavaScript de producción supere el umbral de 500 kB.
- «Cambiar o empezar de nuevo» permita elegir entre varios expedientes de la
  misma sesión desde un selector compacto, paginado y usable en móvil, sin
  exponer objetos o notas ni mezclar el siguiente paso entre personajes.
- «Borrar todos mis datos» exija confirmación, limpie servidor y navegador,
  invalide la sesión y conserve los datos de otro visitante.
- Ayuda en vivo bloquee un Exaltado que supere el límite declarado y no invente
  conversiones para Aumento, Regio o Transmutación.
- El Taller avanzado compare dos bases importadas y exponga las líneas literales
  que dejarían de verse y las que aparecerían, sin afirmar que recalcula la build.
- Toda lectura incompleta ofrezca un informe local revisable sin enviarlo, y un
  resultado parcial nunca pueda confirmarse ni cerrar el ciclo de crafting.
- La cabecera no anuncie IA externa cuando el servidor usa solo reglas y el
  diálogo de privacidad describa el almacenamiento y la recuperación reales.
- Un fallo al descargar un área diferida muestre una recuperación comprensible
  y permita recargar, en lugar de dejar una pantalla vacía.
- Un `.build` válido mayor de 100 kB se importe, mientras JSON roto y cargas
  excesivas respondan 400/413 sin repetir contenido privado.
- Una caída temporal de `/api/meta` ofrezca reintento visible y recupere la
  navegación sin refrescar manualmente ni perder borradores.
- Identificadores vacíos o desmesurados no puedan persistirse y un expediente
  superior a 512 KiB se rechace antes de escribirlo, sin revelar su contenido.
- El cierre de la API sea explícito e idempotente para liberar SQLite tanto en
  producción como al recargar el servidor de desarrollo.
- El simulacro de recuperación restaure una copia íntegra y conserve expediente,
  sesión anónima, diario y sesión de decisión del Mentor con su historial, sin
  leer ni escribir la base real.
- El servidor **compilado** rechace una configuración pública sin proxy
  autorizado antes de abrir tráfico y, con una configuración válida y una base
  temporal, conserve la misma cookie, expediente, diario y conversación del
  Mentor después de detener y volver a arrancar el proceso.
- Cada petición reciba una referencia propia no suplantable; un 5xx debe enlazar
  cabecera, respuesta pública y registro interno sin incluir textos importados,
  mientras los errores 4xx no recargan la interfaz con datos de soporte.
- Toda respuesta funcional de la API —incluidos 4xx, 429 y 5xx— sea privada y
  no almacenable, mientras `/health` y `/ready` permanezcan sin sesión y sin
  caché operativa.

## Antes de admitir usuarios reales

Ejecutar con las variables exactas del alojamiento:

```text
npm run verify:public
```

Esta es la barrera de publicación real. Ejecuta primero
`readiness:deployment`; si detecta modo local, cookies inseguras, proxy sin
acotar, SQLite efímera o credenciales incoherentes, termina antes de iniciar la
barrera larga de navegador. Solo una configuración pública aprobada llega a
`verify:release`. Esa segunda fase conserva el parche objetivo, pero se ejecuta
sin modo público, base real ni claves externas: los recorridos locales no deben
confundirse con el proxy HTTPS ni tocar recursos del alojamiento.

La API pública bloquea con 426 cualquier ruta funcional que llegue por HTTP
directo, antes de crear una sesión o consumir límites. Los sondeos operativos
siguen disponibles sin cookie; una regresión real comprueba tanto el rechazo
directo como la aceptación mediante el proxy HTTPS autorizado.

`npm run drill:restart` reproduce además el ciclo del artefacto que se publicará:
arranca `dist-server` con modo público y SQLite aislada, guarda datos mediante
una petición interpretada como HTTPS, reinicia sobre el mismo archivo y exige
que la sesión siga vinculada. En Windows el sistema puede terminar el proceso
sin entregar la señal a Node; por eso el simulacro exige recuperación incluso
tras ese corte. En Linux exige también la confirmación explícita de cierre limpio.

Para el lanzamiento de PoE2 1.0 se debe ejecutar
`npm run verify:public:1.0`. Además de la configuración pública, su auditor de
parche impide reutilizar la cobertura de 0.5.4f o aprobar un anuncio que todavía
no figure como versión publicada. También reproduce el corpus desde sus textos
fuente y exige copias directas de 1.0, posteriores al lanzamiento, en español e
inglés; una regresión derivada del foro no puede sustituirlas. Además exige dos
recorridos manuales íntegros y posteriores al lanzamiento —jugador nuevo y
jugador experto— con artefactos independientes y sin puntos bloqueados. La
huella por sí sola no basta: el auditor contrasta el contenido versionado, los
metadatos, los cinco puntos, los bloqueos y un mínimo de tres observaciones con
el manifiesto. Cada recorrido se incorpora con `npm run record:walkthrough`;
editar el manifiesto o sus huellas manualmente no forma parte del procedimiento
autorizado.

## Regla de trabajo

Un parche no se considera terminado porque la pantalla se vea bien. Se considera terminado cuando la barrera correspondiente pasa completa. Si una comprobación falla, se corrige la causa; no se elimina ni se ignora la comprobación para obtener un resultado verde.
