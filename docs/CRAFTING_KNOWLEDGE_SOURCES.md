# Fuentes de conocimiento de crafting (PoE2)

> Capa de DATOS, no de motor. Este documento y el registro que describe no
> calculan probabilidades: solo declaran qué se sabe, con qué respaldo y qué
> está bloqueado. Consulta realizada el **2026-08-22**.

## Taxonomía usada

| Estado | Significado |
| --- | --- |
| `verified-complete` | Verificado **y** demostrablemente exhaustivo. Exige scope y peso en todos los candidatos. |
| `verified-partial` | Verificado pero sin poder demostrar que estén todos los candidatos o todos los pesos. |
| `observed-only` | Visto únicamente en capturas o textos del jugador. |
| `unavailable` | No hay dato utilizable, por ausencia de fuente o por bloqueo legal. |

Reglas que el cargador impone, no sugiere: un desconocido es `null` y nunca `0`;
un campo con valor exige procedencia; `verified-complete` exige scope y pesos; un
snapshot parcial nunca entrega base para normalizar probabilidades; el nombre
visible no se acepta como identificador estable.

## Fuentes consultadas

### 1. Grinding Gear Games — Developer Docs (primaria, oficial)

- URL: <https://www.pathofexile.com/developer/docs/data>
- Qué extrae: la política vigente de publicación de datos de PoE2.
- Hallazgo decisivo: GGG no ofrece oficialmente información de juego de PoE2
  fuera de sus APIs admitidas, salvo el árbol de habilidades pasivas. La
  referencia pública actual no expone modificadores, pools ni pesos.
- Riesgo: nulo en fiabilidad; es la fuente primaria. El riesgo es de vigencia:
  si GGG publicara una API de datos, esta conclusión caducaría.

### 2. Grinding Gear Games — Terms of Use (primaria, oficial)

- URL: <https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy>
- Qué extrae: el marco legal que aplica a cualquier dato derivado del juego.
- Cláusula 4: los derechos de GGG cubren «all graphics, logos, text, images and
  all other elements included in and deriving from the gameplay». Cláusula 7(f):
  prohíbe «use any data gathering and extraction tools or software to extract
  information». No existe cláusula que autorice a terceros a republicar datos
  extraídos.
- Política aplicada: hasta disponer de permiso explícito, Exile Copilot no
  copia ni redistribuye un export derivado del cliente. Es una decisión de
  cumplimiento conservadora del proyecto, no asesoramiento jurídico.

### 3. RePoE-fork — export de PoE2 (secundaria, derivada del cliente) — **BLOQUEADA**

- URL: <https://repoe-fork.github.io/poe2/> · repositorio: <https://github.com/repoe-fork/repoe>
- Qué extrae: JSON estáticos derivados de los archivos del cliente, entre ellos
  `mods.json`, `mods.min.json` y `mods_by_base.json`. Declara la versión de
  cliente **4.5.4.10.2**. Es, hasta donde se ha comprobado, la única fuente
  localizada que contendría pesos de aparición de PoE2 sin recurrir a scraping.
- Cómo lo extrae: volcado offline de los ficheros del cliente; no requiere
  scraping por parte de quien lo consume.
- **Por qué está bloqueada.** Su propio `LICENSE.md` separa dos regímenes: el
  código es MIT (Copyright 2016 brather1ng), pero — cita literal — *«Contents of
  generated files (all files in the `data` directory) are owned by Grinding Gear
  Games and shall not be used or published without being in accordance with
  their terms of use»*. El proyecto no interpreta el acceso público como
  permiso de redistribución; por eso no copia ese `mods.json`.
- Riesgos adicionales, aunque el legal se resolviera:
  1. **Correspondencia de versión.** Declara `4.5.4.10.2`, un número de build de
     cliente. No se ha podido mapear a ningún id de `server/data/patches.json`
     (`0.5.4f`, `0.5.0`, `0.3.0`) sin inferir. Registrar un parche inferido
     sería exactamente el tipo de invento que este registro existe para impedir.
  2. **Método.** Es una extracción de terceros, no un export oficial: un cambio
     de esquema o un volcado parcial se propagaría sin aviso.

### 4. poe2wiki.net y guías comunitarias (terciaria, editorial)

- URL de referencia: <https://www.poe2wiki.net/wiki/Template:Mod>
- Qué extrae: fichas de modificadores redactadas por voluntarios.
- Riesgo alto para este uso: no es una fuente versionada, no garantiza
  exhaustividad, no fija parche y no siempre distingue PoE1 de PoE2. Tratarla
  como pool implicaría afirmar una exhaustividad que nadie certifica. **No se ha
  incorporado ningún dato de esta fuente.**

### 5. Evidencia local del jugador (primaria en cuanto al texto del cliente)

`docs/evidence/crafting/2026-08-22/` — cuatro capturas de tooltips y dos textos
de objeto avanzados. Las capturas se han abierto y leído una a una para este
registro; los mínimos que contienen no se han tomado de ningún resumen. Huellas
SHA-256 (prefijo) guardadas en el snapshot para poder detectar sustituciones:

| Archivo | Huella |
| --- | --- |
| `01-transmutation-variants.jpg` | `ff84daa203c2f4a7` |
| `02-augmentation-variants.jpg` | `bc2f905a48bd28b1` |
| `03-regal-variants.jpg` | `d8df02319bd95882` |
| `04-exalted-variants.jpg` | `24a869440ef9931e` |

## Qué se ha incorporado

`server/data/crafting/observedCurrencyActions.2026-08-22.json` —
completeness **`observed-only`**, `redistributionAllowed: false`.

Las cuatro monedas y sus variantes, leídas directamente del tooltip del cliente:

| Acción | Inglés (del propio tooltip) | Objetivo | Límite total declarado | Base | Superior | Perfecto |
| --- | --- | --- | --- | --- | --- | --- |
| Orbe de transmutación | Orb of Transmutation | normal | — | no mostrado | 44 | 70 |
| Orbe de aumento | Orb of Augmentation | mágico | 2 | no mostrado | 44 | 70 |
| Orbe regio | Regal Orb | mágico | — | no mostrado | 35 | no observada |
| Orbe exaltado | Exalted Orb | raro | 6 | no mostrado | 35 | no observada |

«No mostrado» se guarda como `null`, no como 0 ni como «sin restricción». «No
observada» significa que esa variante no aparece en la captura, **no** que no
exista.

## Qué está bloqueado

`server/data/crafting/modPools.unavailable.2026-08-22.json` —
completeness **`unavailable`**, cero candidatos.

No hay pool de modificadores: ni candidatos, ni grados, ni etiquetas, ni niveles
mínimos, ni pesos. La causa está documentada arriba: GGG no publica API de datos
de juego para PoE2, y la única fuente con pesos que se ha localizado excluye
expresamente sus datos de cualquier permiso de republicación.

**Consecuencia directa: hoy no existe base para calcular probabilidades de
crafting en este repositorio.** No es una limitación de implementación; es
ausencia de dato utilizable. El snapshot existe para que esa ausencia quede
registrada y auditable en lugar de rellenarse con ejemplos plausibles.

## Qué haría falta para desbloquearlo

En orden de preferencia, y ninguna de estas vías se ha ejecutado:

1. Que GGG publique una API o un export oficial de datos de juego de PoE2, como
   ya hace con el árbol de pasivas (`grindinggear/poe2-skilltree-export`, que es
   lo que alimenta `server/data/passives/`).
2. Un permiso explícito de GGG que cubra la redistribución del subconjunto
   necesario.
Mientras tanto, el motor debe tratar `status: "unavailable"` y
`probabilityBasis: "insufficient"` como respuestas legítimas y finales.
