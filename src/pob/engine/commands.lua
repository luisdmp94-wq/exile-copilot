-- Lo que la web le pide a Path of Building 2. Entra y sale JSON.
--
--   pobStart()        arranca PoB2 sin pantalla (HeadlessWrapper)
--   pobAnalyse(json)  carga una build en XML y devuelve sus números, lo que
--                     cambian los caminos propuestos y los mejores notables
--                     cercanos según el propio PoB2

local json = require("dkjson")

local function encode(value)
  return json.encode(value, { exception = function() return "null" end })
end

local function number(value)
  if type(value) ~= "number" or value ~= value or value == math.huge or value == -math.huge then
    return 0
  end
  return value
end

local RESISTS = { "Fire", "Cold", "Lightning", "Chaos" }

--- Lo que se enseña de una salida de PoB2 (la principal o la de una prueba).
local function summarise(output)
  local minion = output.Minion
  -- El daño de la habilidad elegida. FullDPS es la suma de las que el código
  -- marca con «Include in Full DPS»: no cambia al elegir otra habilidad, y se
  -- enseñaba como «Calculado para Contagio» el daño de otra. Solo se usa si la
  -- elegida no hace daño por sí misma.
  local dps = number(output.CombinedDPS) > 0 and number(output.CombinedDPS) or number(output.FullDPS)
  local summary = {
    dps = dps,
    hitDps = number(output.TotalDPS),
    dotDps = number(output.TotalDotDPS) > 0 and number(output.TotalDotDPS) or number(output.TotalDot),
    minionDps = minion and number(minion.CombinedDPS) or 0,
    averageHit = number(output.AverageHit),
    speed = number(output.Speed),
    critChance = number(output.CritChance),
    life = number(output.Life),
    energyShield = number(output.EnergyShield),
    mana = number(output.Mana),
    spirit = number(output.Spirit),
    armour = number(output.Armour),
    evasion = number(output.Evasion),
    ehp = number(output.TotalEHP),
    blockChance = number(output.BlockChance),
    movementSpeed = number(output.MovementSpeedMod),
    resists = {},
  }
  for _, elem in ipairs(RESISTS) do
    local final = number(output[elem .. "Resist"])
    summary.resists[elem:lower()] = {
      value = final,
      max = final + number(output["Missing" .. elem .. "Resist"]),
      total = number(output[elem .. "ResistTotal"]),
    }
  end
  return summary
end

local function lineCounts()
  local unsupported = {}
  for _, slot in pairs(build.itemsTab.slots or {}) do
    local item = slot.selItemId and slot.selItemId > 0 and build.itemsTab.items[slot.selItemId]
    if item and not slot.inactive then
      for _, listName in ipairs({ "implicitModLines", "explicitModLines", "enchantModLines", "runeModLines" }) do
        for _, line in ipairs(item[listName] or {}) do
          -- «Used when…» de los amuletos de carga: PoB2 no los modela, no es un error.
          if line.extra and not line.line:match("^Used when") then
            unsupported[#unsupported + 1] = { item = item.name, line = line.line }
          end
        end
      end
    end
  end
  return unsupported
end

local function socketGroups()
  local groups = {}
  for index, group in ipairs(build.skillsTab.socketGroupList) do
    local names = {}
    for _, gem in ipairs(group.gemList or {}) do
      if gem.gemData and gem.enabled ~= false then names[#names + 1] = gem.gemData.name end
    end
    groups[#groups + 1] = {
      index = index,
      label = group.displayLabel or group.label or "",
      enabled = group.enabled ~= false,
      main = index == build.mainSocketGroup,
      gems = names,
    }
  end
  return groups
end

local function mainSkillName()
  local env = build.calcsTab.mainEnv
  local skill = env and env.player and env.player.mainSkill
  if skill and skill.activeEffect and skill.activeEffect.grantedEffect then
    return skill.activeEffect.grantedEffect.name, skill.activeEffect.level
  end
  return nil, nil
end

local function nodeSet(ids)
  local set, count = {}, 0
  for _, id in ipairs(ids or {}) do
    local node = build.spec.nodes[tonumber(id)]
    if node and not node.alloc then
      set[node] = true
      count = count + 1
    end
  end
  return set, count
end

function pobStart()
  local ok, err = pcall(dofile, "HeadlessWrapper.lua")
  if not ok then return encode({ error = tostring(err) }) end
  if not build then
    return encode({ error = tostring(__mainObject__ and __mainObject__.promptMsg or "PoB2 no arrancó") })
  end
  return encode({ ok = true, version = launch and launch.versionNumber or nil })
end

function pobAnalyse(argsText)
  local args = json.decode(argsText)
  if type(args) ~= "table" or type(args.xml) ~= "string" then
    return encode({ error = "bad arguments" })
  end
  local ok, err = pcall(loadBuildFromXML, args.xml, "exile-copilot")
  if not ok then return encode({ error = tostring(err) }) end
  if __mainObject__.promptMsg then
    local message = __mainObject__.promptMsg
    __mainObject__.promptMsg = nil
    return encode({ error = tostring(message) })
  end
  if not build.calcsTab or not build.calcsTab.mainOutput then
    return encode({ error = "PoB2 no calculó esta build" })
  end

  local base = build.calcsTab.mainOutput
  local skillName, skillLevel = mainSkillName()
  local result = {
    main = summarise(base),
    skill = { name = skillName, level = skillLevel },
    groups = socketGroups(),
    unsupported = lineCounts(),
    candidates = {},
    explore = {},
  }

  local calcFunc = build.calcsTab:GetMiscCalculator()

  -- Lo que cambian los caminos que propone la web.
  for _, candidate in ipairs(args.candidates or {}) do
    local set, count = nodeSet(candidate.path)
    if count > 0 then
      local okCalc, output = pcall(calcFunc, { addNodes = set })
      if okCalc and output then
        result.candidates[#result.candidates + 1] = { id = candidate.id, points = count, after = summarise(output) }
      end
    end
  end

  -- Los mejores notables cercanos según PoB2: camino corto, más daño o más aguante por punto.
  local explore = args.explore
  if type(explore) == "table" then
    local maxPoints = tonumber(explore.maxPoints) or 8
    local scanned = 0
    for id, node in pairs(build.spec.nodes) do
      -- Solo notables: una clave cambia cómo funciona el personaje y no se propone así.
      if not node.alloc and node.type == "Notable" and not node.ascendancyName
        and node.path and #node.path > 0 and #node.path <= maxPoints then
        local set = {}
        local ids = {}
        for _, step in ipairs(node.path) do
          set[step] = true
          ids[#ids + 1] = tostring(step.id)
        end
        local okCalc, output = pcall(calcFunc, { addNodes = set })
        scanned = scanned + 1
        if okCalc and output then
          result.explore[#result.explore + 1] = { id = tostring(id), points = #node.path, path = ids, after = summarise(output) }
        end
      end
    end
    result.scanned = scanned
  end

  return encode(result)
end

--- Clases y ascendencias del árbol de PoB2, con los ids que usa su XML.
function pobClasses()
  local tree = build.spec.tree
  local list = {}
  for _, class in pairs(tree.classes) do
    local ascendancies = {}
    for index, ascendancy in pairs(class.classes or {}) do
      if index ~= 0 and ascendancy.internalId then
        ascendancies[#ascendancies + 1] = { internalId = ascendancy.internalId, name = ascendancy.name or ascendancy.id }
      end
    end
    table.sort(ascendancies, function(a, b) return a.internalId < b.internalId end)
    list[#list + 1] = { name = class.name, integerId = class.integerId, ascendancies = ascendancies }
  end
  table.sort(list, function(a, b) return a.integerId < b.integerId end)
  return encode(list)
end

--- Gemas de PoB2: id del juego, variante, nombre y nivel de personaje que pide cada nivel.
function pobGems()
  local list = {}
  for _, gem in pairs(build.data.gems) do
    local effect = gem.grantedEffect
    if effect and gem.gameId then
      local maxLevel = gem.naturalMaxLevel or 1
      if not effect.levels[maxLevel] then maxLevel = #effect.levels end
      local requirements = {}
      for level = 1, maxLevel do
        requirements[level] = effect.levels[level] and effect.levels[level].levelRequirement or 0
      end
      list[#list + 1] = {
        gameId = gem.gameId,
        variantId = gem.variantId,
        name = gem.name,
        support = effect.support and true or false,
        levels = requirements,
      }
    end
  end
  table.sort(list, function(a, b) return a.name < b.name end)
  return encode(list)
end

--- Lo mismo, con los argumentos en un archivo del disco virtual (textos largos).
function pobAnalyseFile(path)
  local handle = io.open(path, "r")
  if not handle then return encode({ error = "missing " .. tostring(path) }) end
  local text = handle:read("*a")
  handle:close()
  return pobAnalyse(text)
end

return "commands"
