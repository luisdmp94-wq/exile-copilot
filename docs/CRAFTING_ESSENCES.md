# Crafting P1 — Essences

Estado: implementado de forma conservadora el 23/08/2026.

## Contrato verificable utilizado

La revisión oficial de Essences del parche 0.3.0 establece cuatro tiers: Lesser,
Normal, Greater y Perfect. Lesser, Normal y Greater elevan un objeto mágico a
raro y añaden un modificador garantizado. Las Perfect Essences y las Essences
obtenidas mediante corrupción retiran un modificador al azar de un objeto raro y
añaden un nuevo modificador garantizado.

Fuentes primarias:

- GGG, [Path of Exile 2: The Third Edict — Essence Rework](https://www.pathofexile.com/forum/view-thread/3826682/page/1), parche 0.3.0.
- GGG, [Path of Exile 2: Fate of the Vaal](https://www.pathofexile.com/forum/view-thread/3932540/filter-account-type/staff), parche 0.5.0. Este parche todavía documenta Essences concretas y cambios relacionados; no se usa como una tabla exhaustiva de resultados.

## Qué hace Exile Copilot

1. El jugador selecciona el tier de la Essence.
2. Copia el nombre y el efecto garantizado desde el tooltip que tiene delante.
3. La app comprueba rareza y estados estructurales conocidos.
4. Para Perfect/corrupted, exige aceptar que cualquier modificador explícito
   actual puede ser retirado al azar.
5. Se guarda una sesión con el snapshot anterior.
6. Después del uso, el jugador pega el objeto resultante.
7. La comparación solo confirma:
   - misma base y mismo nivel de objeto;
   - rareza rara;
   - cero retiradas y un explícito nuevo para Lesser/Normal/Greater; o
   - exactamente un explícito retirado y uno nuevo para Perfect/corrupted;
   - ningún cambio auxiliar inesperado.

## Lo que deliberadamente no hace

- No deduce el efecto por el nombre de una Essence.
- No incorpora una tabla incompleta de modificadores por tipo de objeto.
- No estima probabilidades sin un pool completo, versionado y redistribuible.
- No afirma que una coincidencia estructural demuestre que el resultado sea útil.
- No decide qué modificador será retirado por una Perfect/corrupted Essence.

La legalidad final de una aplicación sigue perteneciendo al cliente del juego.
El asesor bloquea estados conocidos y pide datos ante interacciones todavía no
verificadas, pero no sustituye la validación del juego.
