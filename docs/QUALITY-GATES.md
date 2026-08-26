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
- La bienvenida ofrece sus tres recorridos sin duplicados.
- Se puede crear un personaje, pegar un objeto y cargar el ejemplo.
- La mascota abre y cierra su propio mentor contextual.
- Crafting abre sus tres recorridos sin recuperar el cockpit eliminado.
- Guardar, recomendar, exportar y restaurar siguen funcionando.
- No aparecen errores de navegador, peticiones API fallidas ni recursos 4xx/5xx.
- La prueba usa una base temporal y nunca toca los datos reales del usuario.

## Antes de publicar una versión

Ejecutar:

```text
npm run verify:release
```

Además de la barrera anterior, construye la versión de producción y recorre en desarrollo y producción los flujos especializados de equipo, mentor, academia y coach de Crafting.

La comprobación de producción también exige que:

- Crafting no forme parte de la descarga inicial y se cargue al entrar.
- Editor, plan y mercado conserven su foco accesible aunque sus módulos se carguen bajo demanda.
- El HTML se revalide y los assets con hash usen caché inmutable.
- Ningún paquete JavaScript de producción supere el umbral de 500 kB.
- «Empezar de nuevo» permita recuperar el último expediente guardado desde la bienvenida.
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
- Cada petición reciba una referencia propia no suplantable; un 5xx debe enlazar
  cabecera, respuesta pública y registro interno sin incluir textos importados,
  mientras los errores 4xx no recargan la interfaz con datos de soporte.

Para el lanzamiento de PoE2 1.0, `verify:release` no basta por sí solo. Debe
ejecutarse `npm run verify:1.0`: su auditor previo impide reutilizar la cobertura
de 0.5.4f o aprobar un anuncio que todavía no figure como parche publicado.

## Regla de trabajo

Un parche no se considera terminado porque la pantalla se vea bien. Se considera terminado cuando la barrera correspondiente pasa completa. Si una comprobación falla, se corrige la causa; no se elimina ni se ignora la comprobación para obtener un resultado verde.
