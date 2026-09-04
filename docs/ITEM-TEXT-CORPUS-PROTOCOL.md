# Incorporar una copia directa de objeto al corpus

El corpus demuestra que el importador puede volver a leer exactamente las
formas de tooltip observadas en cada idioma y parche. Una muestra de PoE2 1.0
solo cuenta para el lanzamiento si procede directamente del cliente, declara
el parche y fue observada desde el 11 de diciembre de 2026.

## Captura

1. Activar la descripción avanzada de objetos en PoE2.
2. Copiar el objeto completo con `Ctrl+Alt+C` y guardar ese texto sin corregirlo
   en un archivo temporal.
3. Confirmar visualmente nombre, base, ranura, rareza, nivel de objeto, calidad,
   número de prefijos y sufijos y los estados especiales visibles.
4. No incluir cuenta, personaje, chat, IP ni otra información personal.

## Registro autorizado

Preparar un JSON de confirmación y ejecutar:

```console
npm run record:item-sample -- --input <muestra.json> --text <tooltip.txt>
```

Si hay varias copias observadas, no es necesario incorporarlas una por una:

```text
npm run record:item-sample -- --batch <lote.json>
```

Antes de registrar un lote grande se puede ejecutar el mismo contraste sin
escribir fixtures ni modificar el manifiesto:

```text
npm run record:item-sample -- --check --batch <lote.json>
```

El ensayo usa el parser y el corpus actualmente activos. Si termina en verde,
el archivo puede registrarse quitando únicamente `--check`; no hay que preparar
otro formato ni copiar cada muestra por separado.

El lote tiene la forma siguiente y admite entre una y cien muestras:

```json
{
  "schemaVersion": 1,
  "samples": [
    {
      "submission": {
        "id": "...",
        "locale": "es",
        "patch": "1.0",
        "observedAt": "2026-12-11",
        "source": "Copia directa anonimizada del cliente de PoE2 1.0.",
        "expected": { "...": "misma confirmación que en una muestra individual" }
      },
      "rawText": "Texto completo obtenido con Ctrl+Alt+C"
    }
  ]
}
```

La operación es transaccional: primero contrasta todas las confirmaciones con
el parser y solo después escribe los tooltips y el manifiesto. Un id repetido,
una ruta insegura o una sola lectura contradictoria rechaza el lote completo;
no deja muestras parciales en el corpus.

Ejemplo:

```json
{
  "id": "focused-amulet-en-1.0-2026-12-11-a",
  "locale": "en",
  "patch": "1.0",
  "observedAt": "2026-12-11",
  "source": "Copia directa anonimizada del cliente de PoE2 1.0.",
  "expected": {
    "name": "Observed Pendant",
    "baseType": "Focused Amulet",
    "slot": "amulet",
    "rarity": "rare",
    "itemLevel": 86,
    "quality": 20,
    "prefixCount": 1,
    "suffixCount": 1,
    "diagnosisState": "partial",
    "specialStates": ["fractured"]
  }
}
```

`specialStates` solo admite `fractured`, `desecrated` y `mutated`; se deja vacío
si no aparece ninguno. El estado del diagnóstico describe lo que debe mostrar
la aplicación: `complete`, `partial` o `blocked`.

## Garantías

El comando no copia ciegamente la salida actual del parser. Primero contrasta
los campos confirmados de forma independiente y rechaza cualquier diferencia o
aviso de lectura. Después preserva el tooltip bajo
`server/fixtures/itemText/direct/<parche>/`, deriva el snapshot completo y
actualiza `corpus.json` sin sobrescribir ids o archivos. La auditoría vuelve a
interpretar el texto desde cero en cada suite y durante `readiness:1.0`.

Una muestra rechazada se conserva fuera del corpus de lanzamiento como informe
de fallo hasta corregir el parser. No se rebaja su expectativa para obtener una
prueba verde.
