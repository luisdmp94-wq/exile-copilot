# Auditoría: procedencia del nivel del personaje (Crafting)

Fecha: 2026-08-23 · Baseline auditado: `7d96d65`

## Flujo trazado

1. `src/App.tsx:469` `startManualJourney("item")` → `useCharacter.startManual`.
2. `src/hooks/useCharacter.ts` creaba el perfil mínimo con `level: 1` como valor
   técnico, sin marca alguna de que ese 1 no fuera un nivel observado.
3. El perfil viaja íntegro a `DecisionSessionSection`, que llama a
   `evaluateCraftingCharacterContext` (`shared/craftingCharacterContext.ts:73`).
4. Allí `profile.level < requirements.level` trataba el 1 técnico como nivel real
   y devolvía `requirementStatus: "unmet"` con el hecho «No cumple: nivel 1/70»,
   lo que además fuerza `verdict: "stop"` y, vía `decideCraftingNextStep`, un
   «Detente» en la siguiente decisión.

## Lecturas y escrituras de `level`

Escrituras sin evidencia (raíz del problema):

- `src/hooks/useCharacter.ts` → `startManual` (`level: 1`).
- `server/importers/buildImporter.ts:54` → `level: partial.level ?? 1` cuando el
  código PoB no declara nivel.

Escritura con evidencia:

- `src/sections/CharacterSection.tsx` → campo «Nivel» escrito por el jugador.
- `server/adapters/pob.ts` → `Build level="…"` presente en el XML.
- `server/fixtures/demoSnapshot.json` → nivel 70 declarado en el snapshot.

Lecturas relevantes: `shared/craftingCharacterContext.ts` (Crafting),
`server/engine/rules.ts:260` y `:386` (recomendaciones), `src/lib/journal.ts:38`
y `src/sections/JournalSection.tsx:135` (diario), `server/mentor/mentorService.ts:278`
y `server/mentor/mentorAi.ts:24` (mentor), `shared/decisionSession.ts:393`
(huella de sesión), y las vistas `AppHeader` / `ExpedienteSection`.

## Persistencia

`CharacterProfile` se guarda como JSON íntegro (`POST /character` →
`saveCharacter`) y se relee con `CharacterProfileSchema.parse`. Añadir un campo
**opcional** es retrocompatible en ambos sentidos: los perfiles antiguos cargan
sin él y los nuevos lo conservan en el round-trip. No hay migraciones SQL que
tocar.

## Alcance más allá de Crafting

El mismo placeholder llega a recomendaciones (`rules.ts` puede decir «nivel 70
(eres 1)» y estimar vida esperada sobre un nivel falso), al diario
(`characterLevel` del snapshot) y al mentor. Queda **documentado, no corregido**:
el objetivo de este cambio es Crafting y esas rutas tienen su propio contrato y
sus propias pruebas.

## Contrato adoptado

En `shared/domain.ts`:

- `PLACEHOLDER_CHARACTER_LEVEL = 1` — el único número que la app ha escrito nunca
  en `level` sin evidencia.
- `levelSource?: "observed" | "placeholder"` — campo **opcional** en
  `CharacterProfileSchema`. Ausente = perfil legacy.
- `readCharacterLevel(profile)` — única lectura autorizada. Devuelve
  `{ known: true, level, provenance: "observed" | "legacy-declared" }` o
  `{ known: false, level: null, provenance: "placeholder" | "legacy-placeholder" }`.

Regla de migración legacy: sin `levelSource`, sólo `level === 1` es ambiguo (es
indistinguible del mínimo técnico) y se devuelve como **desconocido**. Cualquier
otro número heredado se declara `legacy-declared`: comparable, pero **nunca**
etiquetado `observed`. No se infiere nivel del objeto, la clase ni la build.

Descartado a propósito: centinelas silenciosos (`0`, `-1`), `level` nullable
(rompería vistas, mentor y motor), y añadir `levelSource` a
`sessionFingerprint` (invalidaría todas las sesiones ya guardadas).

## Comportamiento

| Caso | Antes (`7d96d65`) | Después |
| --- | --- | --- |
| Objeto suelto, sin nivel | «No cumple: nivel 1/70» → `unmet` → `stop` | `unknown` + «No se puede comprobar el requisito de nivel porque no conocemos el nivel de tu personaje» |
| Nivel real 40 vs req. 70 | `unmet` | `unmet` (sin cambios) |
| Nivel real 90 vs req. 70 | `met` | `met` (sin cambios) |
| Legacy sin `levelSource`, nivel 90 | `met` | `met` (`legacy-declared`) |
| Legacy sin `levelSource`, nivel 1 | `unmet` | `unknown` |
