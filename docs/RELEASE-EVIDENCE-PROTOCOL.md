# Registro de evidencia técnica de un parche

Las capacidades de Exile Copilot solo se habilitan para un parche cuando su
evidencia queda ligada a un área concreta, un archivo fuente preservado y dos
huellas verificables. Este procedimiento sirve para `item-import`,
`basic-crafting`, `advanced-crafting`, `passive-tree` y `market`.

## Antes de registrar

- La fuente debe estar dentro del repositorio y conservar la observación,
  exportación o revisión reproducible. No se registra una URL suelta.
- Si se declara un parche, la propia fuente debe mostrarlo o incluir una
  procedencia que permita atribuírselo. Si no puede demostrarse, usar
  `"patch": null`; esa evidencia nunca desbloquea una cobertura completa.
- No incluir cuentas, correos, IP, conversaciones privadas ni otros datos
  personales.
- Una nota explica exactamente qué demuestra la fuente y también sus límites.

## Registro autorizado

Preparar un JSON temporal y ejecutar:

```console
npm run record:evidence -- --input <evidencia.json>
```

Ejemplo:

```json
{
  "evidenceId": "item-import-1.0-es-2026-12-11",
  "featureId": "item-import",
  "patch": "1.0",
  "asOf": "2026-12-11",
  "method": "in-game-observation",
  "subjectPath": "docs/evidence/raw/item-import-1.0-es.txt",
  "note": "Copia directa en español observada dentro del cliente de PoE2 1.0."
}
```

El comando no recibe hashes ni una ruta de salida. Calcula la huella de la
fuente, genera un recibo `EC-RELEASE-EVIDENCE-1`, calcula la huella del recibo y
actualiza `server/data/releaseEvidence.json` sin sobrescribir ids o archivos.
Si cualquier validación o escritura falla, no conserva un alta parcial.

## Qué vuelve a comprobar la aplicación

En desarrollo, producción y `readiness:1.0` se verifican conjuntamente:

1. El recibo existe dentro del artefacto desplegado y conserva su SHA-256.
2. Su contenido coincide exactamente con área, parche, fecha, método, fuente y
   nota declarados en el catálogo.
3. El archivo fuente también existe y conserva su propia SHA-256.
4. La cobertura del parche referencia ese ID en la misma área y no hereda una
   evidencia anterior.

La automatización demuestra integridad y asociación; no convierte una fuente
débil en una prueba válida. La revisión humana sigue siendo responsable de no
atribuir al artefacto más de lo que realmente muestra.
