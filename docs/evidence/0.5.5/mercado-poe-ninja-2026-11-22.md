# Mercado de PoE2 0.5.5h: captura de poe.ninja (2026-11-22)

- Capturado el 2026-11-22 con peticiones directas desde el equipo de desarrollo.
- Es la misma superficie que usa la web (`server/services/poeninja.ts`).
- Atribución al parche: las notas oficiales de 0.5.5 (hilo 4000864) abren la
  liga «Forbidden Rites» y mantienen «Runes of Aldur»; las dos corren con el
  cliente 0.5.5h (ver `notas-oficiales-0.5.5.md`). poe.ninja no publica la
  versión del juego: la atribución sale de esa procedencia, no del JSON.

## Ligas de economía

`GET https://poe.ninja/poe2/api/data/index-state` → `economyLeagues`:

| Liga | Hardcore | Indexada en poe.ninja |
|---|---|---|
| Forbidden Rites | no | no |
| Runes of Aldur | no | sí |
| HC Forbidden Rites | sí | no |
| HC Runes of Aldur | sí | no |
| Standard | no | no |
| Hardcore | sí | no |

`GET https://poe.ninja/poe2/api/economy/leagues` → ["Forbidden Rites", "Runes of Aldur", "HC Forbidden Rites", "HC Runes of Aldur", "Standard", "Hardcore"]

Conclusión: solo «Runes of Aldur» tiene economía indexada. «Forbidden Rites» es
liga de evento y poe.ninja no la indexa. `DEFAULT_LEAGUE=Runes of Aldur` sigue
siendo correcto.

## Cotización de muestra (Runes of Aldur)

`GET https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Runes%20of%20Aldur&type=Currency`
devolvió 46 líneas. Moneda de referencia de la liga: `divine`.

| Moneda | Valor en la moneda de referencia |
|---|---|
| Orb of Alchemy | 0.004261 |
| Exalted Orb | 0.001824 |
| Chaos Orb | 0.1351 |
| Divine Orb | 1 |
| Orb of Annulment | 0.4279 |
| Orb of Augmentation | 0.003972 |
| Regal Orb | 0.0025 |
| Orb of Transmutation | 0.001228 |

## Límites

- Es una foto de un momento: los precios cambian cada hora y no son garantía.
- La web sigue mostrando la procedencia y la hora de cada consulta.
- Si poe.ninja cae o cambia de liga, la web degrada a caché o deja de mostrar
  precios; no inventa valores.
