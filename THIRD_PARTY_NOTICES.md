# Avisos de terceros

Exile Copilot no está afiliado a Grinding Gear Games ni cuenta con su respaldo.
Path of Exile 2 y sus datos son de Grinding Gear Games.

## Path of Building Community — Path of Building 2

«Tus números con PoB2» corre en el navegador el motor de cálculo de
[Path of Building 2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2),
empaquetado por `npm run data:pob` en `server/data/pob/engine.json.gz`.
Sus archivos Lua se reescriben de forma automática para Lua 5.2
(`scripts/lib/luaCompat.ts`); el cálculo es el suyo.

Licencia MIT. El texto completo, con las licencias de terceros que PoB2
incluye, está en [server/data/pob/LICENSE-PathOfBuilding.md](server/data/pob/LICENSE-PathOfBuilding.md).

## lua-wasm-bindings y Lua

El intérprete de Lua 5.2 compilado a WebAssembly viene del paquete
[lua-wasm-bindings](https://github.com/TypeScriptToLua/lua-wasm-bindings)
(TypeScriptToLua), licencia MIT. Lua es de PUC-Rio, licencia MIT:

> Copyright © 1994–2015 Lua.org, PUC-Rio. Permission is hereby granted, free of
> charge, to any person obtaining a copy of this software and associated
> documentation files (the "Software"), to deal in the Software without
> restriction, including without limitation the rights to use, copy, modify,
> merge, publish, distribute, sublicense, and/or sell copies of the Software,
> and to permit persons to whom the Software is furnished to do so, subject to
> the following conditions: The above copyright notice and this permission
> notice shall be included in all copies or substantial portions of the
> Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

## pob-web

Las adaptaciones de LuaJIT a Lua 5.2 de `src/pob/engine/boot.lua` (la
biblioteca `bit`, `lua-utf8` y el reemplazo de `gsub`) siguen las de
[pob-web](https://github.com/krauthaufen/pob-web), de Georg Haaser:

> MIT License. Copyright (c) 2025 Georg Haaser. Permission is hereby granted,
> free of charge, to any person obtaining a copy of this software and associated
> documentation files (the "Software"), to deal in the Software without
> restriction, including without limitation the rights to use, copy, modify,
> merge, publish, distribute, sublicense, and/or sell copies of the Software,
> and to permit persons to whom the Software is furnished to do so, subject to
> the following conditions: The above copyright notice and this permission
> notice shall be included in all copies or substantial portions of the
> Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

## Datos

- Árbol de pasivas, posiciones, iconos y marcos: Grinding Gear Games,
  [grindinggear/poe2-skilltree-export](https://github.com/grindinggear/poe2-skilltree-export).
- Nombres y textos en español de pasivas, gemas, modificadores, bases y
  únicos: [poe2db.tw](https://poe2db.tw).
