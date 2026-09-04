# Decisión de alojamiento público

> Estado: recomendación técnica, no despliegue. Revisado el 31 de agosto de
> 2026 exclusivamente contra documentación oficial de los proveedores.

## Decisión recomendada

Usar **Render como primer entorno de ensayo público**, con estas condiciones:

- un único servicio web de pago;
- ejecución desde el `Dockerfile` del repositorio;
- un único proceso y una única instancia;
- disco persistente montado en `/data`;
- `DATABASE_PATH=/data/exile-copilot.db`;
- comprobación HTTP continua en `/api/ready`;
- región `frankfurt` si sigue disponible al crear el servicio;
- secretos y valores del proxy introducidos en el panel, nunca en el
  repositorio ni durante la construcción de la imagen.

No se debe crear todavía `render.yaml`: primero hay que realizar un despliegue
de ensayo manual y observar los permisos reales del volumen y el salto de red
que Express recibe. Así `TRUST_PROXY` se configura con evidencia del entorno,
no con una suposición que debilite cookies o límites por visitante.

## Por qué Render encaja mejor en esta etapa

La arquitectura actual es deliberadamente de una sola instancia con SQLite.
Render permite adjuntar un disco persistente a un servicio web de pago, pero no
escalar ese servicio a varias instancias. Esa limitación coincide con nuestro
contrato actual en vez de ocultarlo. El disco cifra los datos en reposo y crea
capturas diarias. Fuente oficial:
[Persistent Disks](https://render.com/docs/disks).

Render construye directamente desde un `Dockerfile` y conserva las mismas
funciones principales para servicios Docker. Fuente oficial:
[Docker on Render](https://render.com/docs/docker).

Los sondeos HTTP se usan al desplegar y continúan ejecutándose sobre el
servicio activo. Tras fallos consecutivos, Render deja de enviar tráfico y
reinicia la instancia si la avería continúa. Esto encaja con `/api/ready`, que
prueba una lectura y una escritura reversible en SQLite. Fuente oficial:
[Health Checks](https://render.com/docs/health-checks).

El balanceador de Render termina TLS y entrega la petición al contenedor; el
servidor debe escuchar en `0.0.0.0` y respetar `PORT`. El proveedor ofrece
certificado TLS gestionado y dominio propio. Fuente oficial:
[Web Services](https://render.com/docs/web-services).

## Comparación resumida

### Railway

Railway es sencillo y ofrece volúmenes y copias que incluyen SQLite, pero su
documentación indica dos roces con nuestro contrato actual:

- los volúmenes se montan como `root`; para una imagen que corre sin privilegios
  propone ejecutar con UID 0, lo que debilitaría el contenedor;
- el sondeo de salud decide si una versión nueva entra en servicio, pero no
  monitoriza continuamente el endpoint después del despliegue.

Fuentes oficiales:
[Volumes](https://docs.railway.com/volumes),
[Backups](https://docs.railway.com/volumes/backups) y
[Healthchecks](https://docs.railway.com/deployments/healthchecks).

No queda descartado para siempre. Se reevalúa si Railway permite conservar el
usuario sin privilegios con permisos de volumen explícitos y añade vigilancia
continua equivalente.

### Fly.io

Fly.io ofrece volúmenes locales, capturas, secretos y control de red suficiente,
pero exige más operación manual. Sus volúmenes pertenecen a una máquina y sus
sondeos pueden retirar tráfico o bloquear despliegues, pero un fallo de salud no
reinicia automáticamente la máquina. Para la primera publicación añade trabajo
operativo sin resolver una necesidad que Render no cubra ya.

Fuentes oficiales:
[Fly Volumes](https://fly.io/docs/volumes/overview/),
[Health Checks](https://fly.io/docs/reference/health-checks/) y
[Secrets](https://fly.io/docs/apps/secrets/).

## Límites aceptados

- Render exige un servicio de pago para conservar archivos. El plan gratuito
  no admite disco persistente y no sirve para esta aplicación. Fuente oficial:
  [Free services](https://render.com/docs/free).
- Un disco impide despliegues sin interrupción: Render detiene la instancia
  anterior antes de arrancar la nueva y puede haber unos segundos de caída.
- Una sola instancia es correcta ahora, pero no es alta disponibilidad.
- Las capturas automáticas del disco no se consideran una restauración segura
  de SQLite en caliente. Render desaconseja restaurar capturas de discos usados
  por bases personalizadas; mantendremos la copia con la aplicación detenida y
  el simulacro de restauración propio descrito en `docs/DEPLOYMENT.md`.
- El coste final se confirma en el panel antes de crear nada. No se fija una
  cifra en el repositorio porque planes y precios pueden cambiar.

## Barrera del despliegue de ensayo

El ensayo no recibe jugadores hasta completar y registrar estas comprobaciones:

1. El proceso sigue ejecutándose como usuario `node` y puede crear, leer y
   actualizar `/data/exile-copilot.db` después de reiniciar y redesplegar.
2. `/api/health` y `/api/ready` responden correctamente; un fallo real de
   disponibilidad retira y recupera el servicio como promete el proveedor.
3. Se observa la dirección del proxy que llega a Express y se fija el valor
   mínimo correcto de `TRUST_PROXY`. Nunca se usa `true` ni un rango inventado.
4. Una petición pública se interpreta como HTTPS y la cookie
   `__Host-exile_copilot_session` conserva `Secure`, `HttpOnly`, `Path=/` y
   `SameSite=Strict`.
5. Se reinicia el servicio y el mismo navegador recupera expediente, diario y
   sesión desde el volumen.
6. Se detiene el servicio, se copia SQLite, se restaura en un volumen de ensayo
   separado y se repite el recorrido de recuperación.
7. `npm run verify:public` pasa con las variables exactas del proveedor y un
   `POE_NINJA_USER_AGENT` con contacto real.
8. Se comprueba que no aparecen claves, cookies, objetos ni personajes en los
   registros del proveedor.

Solo después de este ensayo se añade un `render.yaml` reproducible y se plantea
conectar dominio o invitar jugadores externos.
