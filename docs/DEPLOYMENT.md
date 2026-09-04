# Publicación y recuperación de Exile Copilot

Este documento describe el despliegue de una sola instancia de Exile Copilot.
La aplicación usa SQLite y sesiones anónimas en cookie: no debe desplegarse en
varias réplicas ni detrás de balanceo hasta sustituir esos dos componentes por
almacenamiento compartido.

## Antes de publicar

1. Usar Node.js 24 o posterior e instalar exactamente el lockfile con `npm ci`.
2. Cargar las variables exactas del alojamiento y ejecutar
   `npm run verify:public`. La configuración insegura se bloquea antes de la
   barrera larga; ningún fallo de lint, compilación, recuperación, pruebas o
   navegador se ignora para publicar. Para PoE2 1.0 usar
   `npm run verify:public:1.0`.
3. Comprobar que el parche de `DEFAULT_PATCH` aparece en
   `server/data/patchCompatibility.json`. Un parche no revisado debe permanecer
   bloqueado; nunca se autoriza copiando la cobertura de una versión anterior.
4. Crear una ruta persistente para `DATABASE_PATH`. `dist/` y `dist-server/`
   pueden recrearse; la base SQLite no.
5. Guardar las claves de Groq u OpenAI en el gestor de secretos del proveedor,
   nunca en la imagen, el repositorio ni variables `VITE_*`.

## Configuración pública mínima

```text
NODE_ENV=production
PUBLIC_DEPLOYMENT=true
HOST=127.0.0.1
PORT=7177
DATABASE_PATH=/ruta/persistente/exile-copilot.db
DEFAULT_PATCH=0.5.4f
SECURE_COOKIES=true
TRUST_PROXY=loopback
API_RATE_LIMIT_PER_MINUTE=300
WRITE_RATE_LIMIT_PER_MINUTE=60
GUIDANCE_RATE_LIMIT_PER_MINUTE=30
MENTOR_RATE_LIMIT_PER_MINUTE=15
REQUEST_BODY_LIMIT_BYTES=4194304
POE_NINJA_TIMEOUT_MS=8000
POE_NINJA_USER_AGENT=exile-copilot/1.0 (contacto: <correo-o-url-real>)
GGG_OAUTH_ENABLED=false
EXPLAINER_LLM_ENABLED=false
```

El servidor escucha solo en `127.0.0.1` por defecto. Es la opción correcta si
el proxy HTTPS vive en la misma máquina. En un contenedor puede necesitar
`HOST=0.0.0.0`; nunca se debe abrir ese puerto directamente a Internet.

`PUBLIC_DEPLOYMENT=true` activa una barrera de arranque: exige producción,
cookies seguras, proxy de confianza, una base SQLite persistente con ruta
absoluta, un User-Agent identificable para poe.ninja y una clave si el Mentor IA
está habilitado. También exige que `GGG_OAUTH_ENABLED` y
`EXPLAINER_LLM_ENABLED` sigan desactivados: sus adaptadores todavía no son
capacidades operativas y no se pueden habilitar por accidente delante de
usuarios. Si `POE_NINJA_OFFLINE=true`, no exige identidad porque no habrá
peticiones de mercado. Puede comprobarse de forma aislada con
`npm run readiness:deployment`; la barrera final `verify:public` ya incorpora
esta comprobación y debe ejecutarse con las variables reales del alojamiento.
Tras aprobarlas, la barrera larga se ejecuta deliberadamente en procesos
locales aislados: conserva `DEFAULT_PATCH`, pero no hereda modo público, ruta de
la SQLite, cookies, proxy ni claves externas. Así prueba el artefacto completo
sin atacar el origen HTTP como si fuera el proxy, tocar datos reales o gastar el
proveedor. Una regresión impide que los recorridos vuelvan a heredar esas
variables.

El contacto de `POE_NINJA_USER_AGENT` debe ser realmente atendible. La barrera
rechaza `localhost`, `.local`, `.invalid`, `.test`, `.example` y los dominios
reservados `example.com`, `example.net` y `example.org`; no copies un valor de
documentación como si fuera el contacto del servicio publicado.

## Contenedor portable

La selección técnica actual del primer entorno de ensayo es Render, todavía
sin servicio contratado ni configuración automática. La comparación, sus
límites y la barrera obligatoria del ensayo están en
[`docs/HOSTING-DECISION.md`](HOSTING-DECISION.md). No se debe añadir un
`render.yaml` hasta haber observado en un despliegue manual los permisos del
volumen y el proxy real que llega a Express.

El repositorio incluye un `Dockerfile` de dos etapas para proveedores que
admitan una sola instancia con volumen persistente. La imagen:

- compila con Node.js 24 y ejecuta únicamente el servidor ya construido;
- retira las dependencias de desarrollo antes de formar la etapa final;
- se ejecuta como el usuario sin privilegios `node`;
- guarda SQLite en `/data/exile-copilot.db`, declarado como volumen;
- comprueba `/api/ready` cada 30 segundos;
- activa por defecto `PUBLIC_DEPLOYMENT=true` y cookies seguras;
- no contiene `.env`, bases locales, registros, claves ni artefactos de una
  ejecución anterior.

Construcción reproducible:

```text
docker build --pull -t exile-copilot:candidate .
```

La imagen **no arranca como publicación completa solo con sus valores por
defecto**. Es intencionado: el alojamiento debe aportar mediante su gestor de
secretos `TRUST_PROXY` con la IP/CIDR exacta del proxy y un
`POE_NINJA_USER_AGENT` con contacto real. También debe fijar parche, liga y, si
se habilita, la clave del Mentor. La barrera de arranque rechaza valores
genéricos antes de abrir el puerto.

El servicio debe montar un volumen real en `/data` y publicar el puerto 7177
únicamente hacia el proxy HTTPS, nunca directamente a Internet. Por ejemplo,
el enlace del host puede limitarse a `127.0.0.1:7177`; el valor de
`TRUST_PROXY` seguirá siendo la dirección que Express observe realmente para
ese proxy, que debe comprobarse en el proveedor elegido. No se debe asumir que
`loopback` es correcto dentro de una red de contenedores.

Las claves del Mentor se inyectan en tiempo de ejecución. No se pasan como
argumentos de construcción ni se copian desde el árbol. Antes de enviar tráfico
al contenedor definitivo se ejecutan `verify:public` con las mismas variables y
una restauración contra una copia del volumen elegido.

`TRUST_PROXY` debe identificar únicamente el proxy HTTPS controlado. Usa
`loopback` cuando vive en la misma máquina o su IP/CIDR exacta cuando está en
otra red (`TRUST_PROXY=10.20.0.5` o `TRUST_PROXY=10.20.0.0/24`). El valor
genérico `true` queda bloqueado: confiar en cualquier salto permitiría falsear
la IP mediante `X-Forwarded-*` y debilitar los límites por visitante. El proxy
debe terminar HTTPS; las cookies seguras no funcionan sobre HTTP.
Además, con `PUBLIC_DEPLOYMENT=true` toda ruta funcional comprueba el protocolo
real interpretado por Express. Una conexión HTTP directa recibe 426 antes de
crear cookie o consumir límites. Solo `/api/health` y `/api/ready` quedan
disponibles al orquestador sin sesión; el proxy autorizado debe aportar
`X-Forwarded-Proto: https` para el tráfico de jugadores.

El límite HTTP predeterminado es 4 MiB para dejar margen al envoltorio JSON de
un `.build` de hasta 2 MiB. El proxy frontal debe permitir al menos ese mismo
tamaño. Una carga mayor recibe 413 y un JSON público; un JSON roto recibe 400,
nunca un 500 genérico ni un eco del contenido importado.

Cada petición a poe.ninja tiene además un plazo absoluto de 8 segundos,
configurable entre 1 y 30 segundos. Al vencer, se cancela la conexión y se sirve
caché antigua o fixture con procedencia degradada; nunca se presenta ese dato
como precio verificado. Exchange y objetos se consultan en paralelo para que el
peor caso no acumule dos plazos consecutivos.

Las operaciones que escriben tienen además un límite separado de 60 por minuto
y un expediente normalizado no puede superar 512 KiB. Esto evita que el límite
amplio necesario para importar builds se convierta en crecimiento ilimitado de
SQLite. El proxy debe conservar también sus propios límites por IP.

El Mentor con IA es opcional. La publicación inicial puede usar
`MENTOR_AI_ENABLED=false`: el motor determinista sigue disponible y no genera
coste externo. Si se activa, conviene empezar con límites bajos, monitorizar 429,
timeouts y consumo, y conservar siempre el respaldo por reglas.

## Construcción y arranque

```text
npm run build
npm start
```

El build crea `dist/` para el navegador y `dist-server/` para el servidor. El
arranque de producción no depende de `tsx` ni compila código en caliente.
Al recibir `SIGTERM` o `SIGINT`, deja de aceptar tráfico, drena las conexiones
durante un máximo de 10 segundos y cierra SQLite explícitamente. El mensaje
«HTTP y SQLite cerrados correctamente» confirma que ya se puede copiar la base.

Antes de publicar, `npm run drill:restart` arranca exactamente ese servidor
compilado con una SQLite temporal y modo público. Comprueba que una configuración
sin proxy falla antes de escuchar, que HTTP directo no crea cookie, que la cookie
por HTTPS es protegida y que el mismo expediente y diario reaparecen después de
reiniciar el proceso sobre el mismo archivo. El simulacro nunca usa
`DATABASE_PATH` ni las sesiones reales del operador y forma parte de
`verify:release`.

Después de arrancar:

- `GET /api/health` debe devolver 200: solo confirma que el proceso HTTP sigue
  vivo y publica el parche esperado. `dataUpdatedAt` debe coincidir con la
  evidencia o revisión más reciente, no con la hora del sondeo.
- `GET /api/ready` debe devolver 200 antes de enviar tráfico. Comprueba que
  SQLite acepta lecturas y una escritura reversible, que el parche tiene
  metadatos y cobertura autorizada
  y, si `PUBLIC_DEPLOYMENT=true`, que la configuración pública sigue siendo
  segura. Un 503 debe retirar la instancia del balanceador, no reiniciarla a
  ciegas mientras `/api/health` continúe respondiendo.
- Ambos son sondeos operativos sin estado: conservan las cabeceras de seguridad
  y una referencia `X-Request-Id`, pero no crean la cookie anónima del jugador ni
  consumen sus límites de uso. Tanto el 200 como el 503 llevan
  `Cache-Control: no-store`; el monitor debe consultar siempre el estado actual
  y nunca reutilizar una respuesta anterior. El proxy puede aplicar un límite
  propio y razonable a esas rutas sin convertirlo en un límite de visitante.
- Todas las demás respuestas de `/api` llevan
  `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache` y
  `Vary: Cookie`. El proxy o CDN no puede almacenar ni reutilizar entre sesiones
  un expediente, diario, mensaje del Mentor, error o respuesta de límite.
- La portada debe devolver HTML y las cabeceras CSP, `nosniff`, `DENY` y HSTS.
  La CSP solo permite marcos externos desde `www.youtube-nocookie.com`; abrir
  Música no crea ese marco y el jugador debe aceptar «Reproducir con YouTube»
  antes de que el navegador contacte con el proveedor.
- Una cookie de sesión pública debe llamarse `__Host-exile_copilot_session`, usar
  un UUID v4 generado por el servidor y llevar `HttpOnly`, `SameSite=Strict`,
  `Secure` y `Path=/`. El prefijo `__Host-` evita que otro subdominio fije la
  sesión.
- El recorrido «Evaluar o craftear» debe aceptar una pieza sin crear antes un
  personaje y debe conservar el parche activo.
- La cabecera debe decir «Mentor por reglas» cuando no hay proveedor externo
  configurado, o «IA asistida» únicamente cuando el interruptor y la clave son
  operativos. `GET /api/health` publica ese modo, pero nunca la clave ni el modelo.

## Persistencia y privacidad actual

Cada navegador recibe una identidad anónima. Un visitante no puede leer ni
sobrescribir el personaje o diario de otro. No existe todavía cuenta, inicio de
sesión ni recuperación entre dispositivos: si el jugador borra la cookie pierde
el vínculo con sus datos aunque la fila siga en la base. Esto debe explicarse en
la interfaz pública. El enlace «Privacidad y datos» del pie muestra ese límite,
qué se guarda y si las consultas del Mentor pueden salir hacia Groq u OpenAI.
Cuando la IA está activa, el proveedor recibe la pregunta, hasta ocho turnos y
un contexto acotado de clase, defensas, objetivo, presupuesto, nombres/bases de
equipo, decisión y reglas activas de build o Crafting. No recibe nombre del
personaje, cookie, id de expediente, tooltips completos, afijos crudos ni el
resultado libre del diario. OpenAI recibe además `store=false` y un
`safety_identifier` irreversible derivado de la sesión anónima, nunca del id del
personaje; la cookie real no sale del servidor.

«Empezar de nuevo» aparta el expediente actual y la bienvenida permite recuperar
el último personaje guardado en ese mismo navegador. No es un borrado del
servidor. «Borrar todos mis datos» usa una segunda confirmación y elimina de forma
irreversible todos los expedientes, objetos, diario, memoria y sesiones ligados a
la cookie anónima actual. También limpia las claves locales de Exile Copilot,
invalida la cookie y abre una sesión nueva. La prueba pública demuestra que esta
operación no puede borrar ni leer los datos de otro visitante.

El control de Música muestra su procedencia antes de cargar ningún contenido
externo. Si el jugador acepta reproducir, su navegador conecta directamente con
`www.youtube-nocookie.com`; YouTube puede recibir la dirección IP y datos
técnicos del navegador, pero Exile Copilot no adjunta personaje ni expediente.

No se deben registrar cuerpos de peticiones, textos de objetos, claves ni
cookies. Cada respuesta de la API incluye un `X-Request-Id` generado por el
servidor. Ante un 5xx, la interfaz muestra esa referencia y el registro interno
la incluye en un evento seguro; permite localizar el incidente sin pedir al
jugador capturas que puedan contener su personaje u objeto. El evento no guarda
el mensaje de la excepción: conserva clase y una huella de la pila para agrupar
fallos iguales sin convertir los registros en otra copia de datos privados. Las
referencias que envíe un cliente se ignoran y los errores corregibles 4xx no
añaden ese ruido a la interfaz.

Los eventos operativos salen como una línea JSON y tienen dos contratos
iniciales:

- `api_unexpected_error`: `requestId`, clase de error y huella; alerta ante
  cualquier aparición y permite correlacionarla con la referencia pública.
- `rate_limit_exceeded`: ámbito, límite y segundos de reintento; permite alertar
  por volumen sostenido sin registrar la IP que formó la ventana.
- `mentor_provider_fallback`: proveedor y categoría acotada (`timeout`,
  `provider_http`, `provider_unavailable`, `refusal` o `invalid_response`). No
  registra pregunta, conversación, respuesta ni el motivo textual del fallo.

Ninguno acepta ruta, IP, cookie, id de sesión, personaje, objeto ni texto del
jugador. El recolector del alojamiento debe indexar `event`, `scope` y
`requestId`, aplicar retención corta y restringir el acceso a operación.

Los límites de peticiones viven en memoria y se reinician al reiniciar el
proceso. El almacenamiento local conserva como máximo 10.000 ventanas por
limitador: al llenarse retira primero las caducadas y después sustituye la más
antigua, por lo que una rotación de IPs no puede hacer crecer la memoria sin
límite. Sigue siendo protección para una sola instancia y no sustituye los
límites compartidos del proxy o del proveedor.

## Copia de seguridad

La copia más segura de esta etapa es con la aplicación detenida:

1. Detener el proceso de Exile Copilot y confirmar que ya no acepta peticiones.
2. Copiar el archivo indicado por `DATABASE_PATH` a almacenamiento cifrado y
   fechado. Si existen archivos `-wal` o `-shm`, conservarlos junto a la copia.
3. Reiniciar la aplicación y comprobar `/api/health` y `/api/ready`.
4. Conservar al menos una copia diaria y una copia previa a cada despliegue o
   migración de datos.
5. Probar periódicamente la restauración en una ruta temporal; una copia que
   nunca se ha restaurado no se considera verificada.

`npm run drill:restore` ejecuta esa comprobación de forma aislada antes de cada
publicación: crea datos sintéticos mediante la API, incluido un expediente, su
diario y una sesión activa del Mentor; cierra SQLite, copia también los archivos
`-wal`/`-shm` si existen, valida `PRAGMA integrity_check` y recupera todo con la
misma sesión anónima. Nunca lee `DATABASE_PATH` ni la base real. Este simulacro
prueba nuestro procedimiento, pero no sustituye la
restauración periódica de una copia creada por el alojamiento real.

## Recuperación

1. Detener el servicio.
2. Apartar —sin borrar— la base dañada y sus archivos `-wal`/`-shm`.
3. Restaurar el conjunto de la última copia en la ruta exacta de
   `DATABASE_PATH` y con permisos de escritura para el proceso.
4. Arrancar una sola instancia.
5. Verificar `/api/health`, `/api/ready`, restauración de un personaje de
   prueba, diario y apertura de Crafting.
6. Si el problema apareció tras una versión nueva, volver al artefacto anterior
   manteniendo una copia separada de la base más reciente para investigar.

No se debe usar `git reset`, borrar `data/` ni reemplazar una base en caliente
como procedimiento de recuperación.

## Señales que deben alertar

- Cualquier evento `api_unexpected_error`, respuestas 5xx o reinicios repetidos.
- Una referencia 5xx comunicada por un jugador que no aparezca en los registros.
- Muchos 401/404 sobre personajes propios después de un despliegue.
- Aumento sostenido de eventos `rate_limit_exceeded` en Mentor o
  recomendaciones.
- Aumento de `mentor_provider_fallback`, especialmente `timeout` o
  `provider_unavailable`; el jugador seguirá recibiendo reglas, pero el servicio
  externo está degradado.
- Base sin espacio, errores SQLite, WAL que crece sin estabilizarse.
- `/api/health` anuncia un parche distinto del esperado.
- `/api/ready` devuelve 503 o cambia de `ready` a `not-ready`.
- Un parche nuevo aparece como compatible sin evidencias específicas.

Antes de PoE2 1.0 se hará una activación separada siguiendo
`docs/POE2-1.0-READINESS.md`; el anuncio de la fecha no autoriza todavía datos ni
mecánicas de 1.0.
