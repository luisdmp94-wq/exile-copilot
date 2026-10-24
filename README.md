# Exile Mentor

**What to fix first in your Path of Exile 2 build.**

Paste your Path of Building 2 code (or type four numbers from your character
sheet) and Exile Mentor tells you, in plain words, the top things holding your
character back — and remembers your last check so you can see your progress.

> Free, no account, no ads. Your build never leaves your browser.

*Resumen en español [más abajo](#en-español).*

## What it checks

Exile Mentor only says things it can back up with the numbers it read:

| Check | Example |
| --- | --- |
| Elemental resistances below 75% | `Fire 52% · 23 points short` — *you take 92% more fire damage than at 75%* |
| Empty gear slots | `Empty: Belt, Ring 2` |
| Negative chaos resistance | `Chaos −24% · 24 points short of 0%` |

Up to three priorities, most urgent first. "Extra damage taken" is plain
arithmetic: damage of a type scales with `100 − resistance`. If everything it
checks is fine, it says so instead of inventing advice.

**Your progress.** Each check is saved in your browser (up to 20, nothing is
sent anywhere). Next time you get a comparison: level, resistance changes,
slots you filled and priorities you fixed. One click forgets them all.

**English and Spanish**, switchable at any time.

## How to use it

1. In **Path of Building 2**: *Import/Export Build → Generate → Copy*.
2. Paste the code into Exile Mentor and press **Check my build**.
3. No PoB? Choose **I'll type it in** and copy your four resistances from the
   in-game character sheet, then tick any empty gear slots.

The numbers are the ones Path of Building calculates with your PoB
configuration, so they can differ slightly from the game if PoB is set up
differently (campaign penalty, buffs, charges).

## Privacy

- The PoB code is decompressed and read **in your browser**. There are no
  requests to any server when you check a build.
- Saved checks and your language choice live in your browser's local storage.
- The public site is static: no accounts, cookies, analytics or third-party
  scripts.

## Status

Early release ahead of Path of Exile 2's 1.0 launch (11 December 2026). The
rules will be reviewed against the 1.0 patch notes. Planned next: knowing which
act you are in and the next goal for your character while you level.

## Run it locally

Requires **Node.js 24** and npm.

```bash
npm install
npm run dev            # http://localhost:7100/check
```

| Command | What it does |
| --- | --- |
| `npm run build:check` | Builds the public static site into `dist-check/` |
| `npm run preview:check` | Serves that build on http://localhost:7300 |
| `npm test` | Runs the test suite (Vitest) |
| `npm run lint` | ESLint |

The public site is a static build of the `relaunch` branch (build command
`npm run build:check`, output directory `dist-check`), meant for Cloudflare
Pages; `public-check/_headers` holds its security headers.

### Where the code lives

| Path | Purpose |
| --- | --- |
| `src/check/` | The build check page, manual form and standalone entry |
| `src/lib/buildPriorities.ts` | The rules |
| `src/lib/checkHistory.ts` | Saved checks and progress comparison |
| `src/lib/checkText.ts` | All texts, English and Spanish |
| `src/lib/pobBrowser.ts` | Reads a PoB2 code in the browser |
| `server/adapters/pobXml.ts`, `server/importers/pobProfile.ts` | PoB2 XML reading, shared by browser and server |
| `tests/unit/` | Tests (`buildPriorities`, `checkHistory`, `checkText`, `pobBrowser`…) |

The repository still contains the previous, larger app (*Exile Copilot*:
server, crafting guide, AI mentor). Its documentation is the
[README in the `archivo-v0` branch](https://github.com/luisdmp94-wq/exile-copilot/blob/archivo-v0/README.md).

## Data and assets

- No game data APIs are used by the build check: everything comes from the
  code or numbers you provide.
- No Grinding Gear Games artwork is used. The icon is an original design.

## Disclaimer

This product isn't affiliated with or endorsed by Grinding Gear Games in any
way. Path of Exile is a trademark of Grinding Gear Games.

---

## En español

**Exile Mentor** te dice qué arreglar primero en tu personaje de Path of Exile 2.

- Pega tu código de **Path of Building 2** o escribe tus cuatro resistencias de
  la hoja de personaje.
- Te da hasta 3 prioridades con su dato: resistencias elementales por debajo
  del 75 %, huecos de equipo vacíos y resistencia al caos negativa, con cuánto
  daño extra recibes por ello.
- Recuerda tu último chequeo y te dice qué has mejorado.
- Funciona en español e inglés.
- **Tu build no sale de tu navegador**: no hay cuentas, ni servidor, ni
  analítica.

Para ejecutarlo en local: `npm install` y `npm run dev`, y abre
http://localhost:7100/check.

*Este producto no está afiliado ni respaldado por Grinding Gear Games.*
