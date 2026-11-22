# Exile Copilot

**El compañero en español para empezar en Path of Exile 2.**
Web: <https://exilecopilot.com> · Español e inglés · Gratis, sin cuenta.

*A Path of Exile 2 companion for new players, in Spanish and English.*

## Qué hace

- **Tu personaje y el mentor.** Pegas tu personaje (código de Path of
  Building 2 o los datos a mano) y el mentor te dice qué mejorar primero, con
  el dato que lo justifica. Si no sabe algo, lo dice.
- **Guías por acto.** Actos 1 a 4: zonas, jefes y recompensas, en orden.
- **Árbol de pasivas.** El árbol oficial de GGG con los nombres en español.
  Path of Building 2 funciona **dentro del navegador**: marcas el árbol a mano,
  ves sus números reales y lo exportas a PoB2.
- **Crafting.** Te enseña el siguiente paso seguro y lo haces tú en el juego.
  No promete resultados ni probabilidades que no puede demostrar.
- **Plan y mercado.** Un plan con el siguiente paso de tu personaje y precios
  de poe.ninja (una foto del momento, no un precio garantizado).

Qué parte está comprobada para cada parche del juego:
`server/data/patchCompatibility.json` y
[docs/POE2-1.0-READINESS.md](docs/POE2-1.0-READINESS.md).

## Arrancar en local

Hace falta **Node.js 24** y npm.

```bash
npm install
cp .env.example .env      # valores de desarrollo; no hace falta tocarlos
npm run dev               # web y API en http://localhost:7100
```

| Comando | Para qué |
| --- | --- |
| `npm test` | Tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | Compila web, guías y servidor (`dist/`, `dist-server/`) |
| `npm start` | Arranca lo compilado, como en producción |
| `node scripts/browser-smoke.mjs` | Recorre la web en un navegador real (`--dev`: modo desarrollo; `--all`: los dos) |
| `node scripts/mentor-smoke.mjs` | Recorre el mentor (mismas opciones) |

La base de datos es SQLite (`DATABASE_PATH`, por defecto
`./data/exile-copilot.db`). El mentor con IA es opcional: sin clave, el mentor
funciona solo con reglas.

## Datos del juego

Cuando cambia el parche, estos comandos rehacen los datos. Cada uno comprueba
lo que descarga y no escribe nada si algo falla.

| Comando | Qué actualiza |
| --- | --- |
| `npm run data:status` | Resumen: qué está al día y qué falta. Con `-- --online --target 1.0` mira también GGG y PoB2 |
| `npm run data:tree -- --latest` | Árbol de pasivas (export oficial de GGG + nombres en español de poe2db) |
| `npm run data:pob -- --latest` | Path of Building 2 para el navegador (motor, clases, gemas) |
| `npm run data:items-en` | Traducción de objetos en español (modificadores, bases, únicos) |
| `npm run data:gems` / `-- --en` | Gemas en español / inglés (poe2db) |

El paso a paso del día de un parche grande está en
[docs/DIA-DE-LA-1.0.md](docs/DIA-DE-LA-1.0.md).

## Despliegue

- **Render**, servicio web desde el `Dockerfile`, una instancia, disco
  persistente en `/data` para SQLite, salud en `/api/ready`.
- **Cada push a `main` se publica solo.** Durante 1-2 minutos la web puede
  dar errores mientras arranca la versión nueva.
- La configuración vive en Render → Environment (`DEFAULT_PATCH`,
  `DEFAULT_LEAGUE`, claves). Nunca en el repositorio.
- **Copias:** Render guarda una instantánea del disco al día (7 días) y la web
  sube cada noche una copia de SQLite a Cloudflare R2 (30 días).
  `npm run backup -- list | check | now`.
- Detalles, variables y cómo restaurar:
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Dónde está cada cosa

| Ruta | Qué hay |
| --- | --- |
| `src/` | La web (React). `src/guides/` guías por acto, `src/pob/` PoB2 en el navegador |
| `server/` | La API (Express + SQLite), mentor, crafting, mercado |
| `server/data/` | Datos versionados del juego y fichas de compatibilidad |
| `scripts/` | Comandos de datos, pruebas de humo y auditorías |
| `docs/` | Proceso, decisiones y evidencias |

## Licencias y avisos

Path of Building 2 se usa bajo su licencia (`server/data/pob/LICENSE-PathOfBuilding.md`).
Otros avisos en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This product isn't affiliated with or endorsed by Grinding Gear Games in any
way. Path of Exile is a trademark of Grinding Gear Games.
