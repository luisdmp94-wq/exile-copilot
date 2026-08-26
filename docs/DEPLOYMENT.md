# Publicación y recuperación de Exile Copilot

Este documento describe el despliegue de una sola instancia de Exile Copilot.
La aplicación usa SQLite y sesiones anónimas en cookie: no debe desplegarse en
varias réplicas ni detrás de balanceo hasta sustituir esos dos componentes por
almacenamiento compartido.

## Antes de publicar

1. Usar Node.js 24 o posterior e instalar exactamente el lockfile con `npm ci`.
2. Ejecutar `npm run verify:release`. Ningún fallo de una ruta de navegador se
   ignora para publicar.
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
PORT=7177
DATABASE_PATH=/ruta/persistente/exile-copilot.db
DEFAULT_PATCH=0.5.4f
SECURE_COOKIES=true
TRUST_PROXY=true
API_RATE_LIMIT_PER_MINUTE=300
WRITE_RATE_LIMIT_PER_MINUTE=60
GUIDANCE_RATE_LIMIT_PER_MINUTE=30
MENTOR_RATE_LIMIT_PER_MINUTE=15
REQUEST_BODY_LIMIT_BYTES=4194304
```

`TRUST_PROXY=true` solo es correcto detrás de un proxy controlado que sustituye
`X-Forwarded-For`. Si Node recibe Internet directamente, debe ser `false`.
El proxy debe terminar HTTPS; las cookies seguras no funcionan sobre HTTP.

El límite HTTP predeterminado es 4 MiB para dejar margen al envoltorio JSON de
un `.build` de hasta 2 MiB. El proxy frontal debe permitir al menos ese mismo
tamaño. Una carga mayor recibe 413 y un JSON público; un JSON roto recibe 400,
nunca un 500 genérico ni un eco del contenido importado.

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

Después de arrancar:

- `GET /api/health` debe devolver 200 y el parche esperado.
- La portada debe devolver HTML y las cabeceras CSP, `nosniff`, `DENY` y HSTS.
- Una cookie de sesión debe ser `HttpOnly`, `SameSite=Strict` y `Secure` bajo HTTPS.
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

«Empezar de nuevo» aparta el expediente actual y la bienvenida permite recuperar
el último personaje guardado en ese mismo navegador. No es un borrado del
servidor. Antes de abrir registros públicos hay que decidir expresamente entre
borrado irreversible confirmado o papelera recuperable y añadir una prueba de
aislamiento para esa operación.

No se deben registrar cuerpos de peticiones, textos de objetos, claves ni
cookies. Cada respuesta de la API incluye un `X-Request-Id` generado por el
servidor. Ante un 5xx, la interfaz muestra esa referencia y el registro interno
la incluye junto al error completo; permite localizar el incidente sin pedir al
jugador capturas que puedan contener su personaje u objeto. Las referencias que
envíe un cliente se ignoran y los errores corregibles 4xx no añaden ese ruido a
la interfaz.

Los límites de peticiones viven en memoria y se reinician al reiniciar el
proceso. Son protección básica, no sustituyen los límites del proxy o proveedor.

## Copia de seguridad

La copia más segura de esta etapa es con la aplicación detenida:

1. Detener el proceso de Exile Copilot y confirmar que ya no acepta peticiones.
2. Copiar el archivo indicado por `DATABASE_PATH` a almacenamiento cifrado y
   fechado. Si existen archivos `-wal` o `-shm`, conservarlos junto a la copia.
3. Reiniciar la aplicación y comprobar `/api/health`.
4. Conservar al menos una copia diaria y una copia previa a cada despliegue o
   migración de datos.
5. Probar periódicamente la restauración en una ruta temporal; una copia que
   nunca se ha restaurado no se considera verificada.

## Recuperación

1. Detener el servicio.
2. Apartar —sin borrar— la base dañada y sus archivos `-wal`/`-shm`.
3. Restaurar el conjunto de la última copia en la ruta exacta de
   `DATABASE_PATH` y con permisos de escritura para el proceso.
4. Arrancar una sola instancia.
5. Verificar `/api/health`, restauración de un personaje de prueba, diario y
   apertura de Crafting.
6. Si el problema apareció tras una versión nueva, volver al artefacto anterior
   manteniendo una copia separada de la base más reciente para investigar.

No se debe usar `git reset`, borrar `data/` ni reemplazar una base en caliente
como procedimiento de recuperación.

## Señales que deben alertar

- Respuestas 5xx o reinicios repetidos.
- Una referencia 5xx comunicada por un jugador que no aparezca en los registros.
- Muchos 401/404 sobre personajes propios después de un despliegue.
- Aumento sostenido de 429 en Mentor o recomendaciones.
- Base sin espacio, errores SQLite, WAL que crece sin estabilizarse.
- `/api/health` anuncia un parche distinto del esperado.
- Un parche nuevo aparece como compatible sin evidencias específicas.

Antes de PoE2 1.0 se hará una activación separada siguiendo
`docs/POE2-1.0-READINESS.md`; el anuncio de la fecha no autoriza todavía datos ni
mecánicas de 1.0.
