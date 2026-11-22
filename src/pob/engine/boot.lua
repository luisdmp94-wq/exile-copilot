-- Arranque de Path of Building 2 dentro de la web (Lua 5.2 en WebAssembly).
--
-- No hay disco: los archivos de PoB2 llegan desde JavaScript a trozos y viven
-- en esta tabla. `io.open`, `loadfile`, `dofile` y `require` leen de aquí.
-- Después se iguala lo poco en que el LuaJIT de PoB2 y Lua 5.2 se comportan
-- distinto. Las ideas de compatibilidad (bit, lua-utf8, gsub) vienen del
-- proyecto pob-web de Georg Haaser (MIT); ver THIRD_PARTY_NOTICES.md.

local files = {}
local pending = {}

function __vfs_append(path, chunk)
  local list = pending[path]
  if not list then
    list = {}
    pending[path] = list
  end
  list[#list + 1] = chunk
  return "ok"
end

function __vfs_finish()
  local count = 0
  for path, list in pairs(pending) do
    files[path] = table.concat(list)
    count = count + 1
  end
  pending = {}
  return tostring(count)
end

local cwd = "src/"

local function normalize(path)
  path = path:gsub("\\", "/")
  if path:sub(1, 1) == "/" then
    path = path:sub(2)
  else
    path = cwd .. path
  end
  local out = {}
  for part in path:gmatch("[^/]+") do
    if part == ".." then
      out[#out] = nil
    elseif part ~= "." and part ~= "" then
      out[#out + 1] = part
    end
  end
  return table.concat(out, "/")
end

local function newReader(data)
  local handle = { data = data, pos = 1 }
  function handle:read(fmt)
    fmt = fmt or "*l"
    if type(fmt) == "number" then
      if self.pos > #self.data then return nil end
      local s = self.data:sub(self.pos, self.pos + fmt - 1)
      self.pos = self.pos + fmt
      return s
    end
    fmt = fmt:gsub("^%*", "")
    local kind = fmt:sub(1, 1)
    if kind == "a" then
      local s = self.data:sub(self.pos)
      self.pos = #self.data + 1
      return s
    elseif kind == "l" or kind == "L" then
      if self.pos > #self.data then return nil end
      local newline = self.data:find("\n", self.pos, true)
      local line
      if newline then
        line = self.data:sub(self.pos, kind == "L" and newline or newline - 1)
        self.pos = newline + 1
      else
        line = self.data:sub(self.pos)
        self.pos = #self.data + 1
      end
      if kind == "l" then line = line:gsub("\r$", "") end
      return line
    elseif kind == "n" then
      local s, e = self.data:find("^%s*[-+]?%d*%.?%d+[eE]?[-+]?%d*", self.pos)
      if not s then return nil end
      self.pos = e + 1
      return tonumber(self.data:sub(s, e))
    end
    return nil
  end
  function handle:lines(fmt)
    return function() return self:read(fmt or "*l") end
  end
  function handle:seek(whence, offset)
    whence = whence or "cur"
    offset = offset or 0
    if whence == "set" then
      self.pos = offset + 1
    elseif whence == "end" then
      self.pos = #self.data + offset + 1
    else
      self.pos = self.pos + offset
    end
    return self.pos - 1
  end
  function handle:close() return true end
  function handle:setvbuf() return true end
  function handle:write() return self end
  function handle:flush() return self end
  return handle
end

local function newWriter(path, append)
  local parts = {}
  if append and files[path] then parts[1] = files[path] end
  local handle = {}
  function handle:write(...)
    for i = 1, select("#", ...) do
      parts[#parts + 1] = tostring((select(i, ...)))
    end
    return self
  end
  function handle:close()
    files[path] = table.concat(parts)
    return true
  end
  function handle:flush() return self end
  function handle:setvbuf() return true end
  function handle:seek() return 0 end
  function handle:read() return nil end
  function handle:lines() return function() return nil end end
  return handle
end

io.open = function(path, mode)
  mode = mode or "r"
  local key = normalize(path)
  if mode:find("w") then return newWriter(key, false) end
  if mode:find("a") then return newWriter(key, true) end
  local data = files[key]
  if not data then return nil, path .. ": No such file or directory", 2 end
  return newReader(data)
end

io.lines = function(path, fmt)
  if not path then return function() return nil end end
  local handle, err = io.open(path, "r")
  if not handle then error(err, 2) end
  return handle:lines(fmt)
end

io.popen = nil
-- HeadlessWrapper espera una tecla si algo falla al arrancar: aquí no hay teclado.
io.read = function() return nil end

loadfile = function(path)
  local key = normalize(path)
  local data = files[key]
  if not data then return nil, "cannot open " .. path end
  -- Como luaL_loadfile: una primera línea que empieza por «#» no es código.
  if data:sub(1, 1) == "#" then data = data:gsub("^[^\n]*", "", 1) end
  return load(data, "@" .. key)
end

dofile = function(path)
  local func, err = loadfile(path)
  if not func then error(err, 2) end
  return func()
end

os.remove = function() return true end
os.rename = function() return true end
os.exit = function() error("os.exit") end
os.getenv = function() return nil end

local searchers = package.searchers or package.loaders
table.insert(searchers, 2, function(name)
  local rel = name:gsub("%.", "/")
  for _, candidate in ipairs({
    "runtime/lua/" .. rel .. ".lua",
    "runtime/lua/" .. rel .. "/init.lua",
    "src/" .. rel .. ".lua",
  }) do
    local data = files[candidate]
    if data then
      local func, err = load(data, "@" .. candidate)
      if not func then error(err) end
      return func
    end
  end
  return "\n\tno file '" .. name .. "' in the virtual disk"
end)

-- Comprobación al empaquetar: ¿compila cada archivo en Lua 5.2?
function __vfs_check()
  local errors, total = {}, 0
  for path, data in pairs(files) do
    if path:match("%.lua$") then
      total = total + 1
      if data:sub(1, 1) == "#" then data = data:gsub("^[^\n]*", "", 1) end
      local ok, err = load(data, "@" .. path)
      if not ok then errors[#errors + 1] = err end
    end
  end
  table.sort(errors)
  return total .. "\n" .. table.concat(errors, "\n")
end

-- ---------------------------------------------------------------------------
-- LuaJIT → Lua 5.2
-- ---------------------------------------------------------------------------

jit = { opt = { start = function() end }, version = "exile-copilot" }
arg = {}
unpack = unpack or table.unpack
loadstring = loadstring or load
math.pow = math.pow or function(a, b) return a ^ b end
table.maxn = table.maxn or function(t)
  local max = 0
  for k in pairs(t) do
    if type(k) == "number" and k > max then max = k end
  end
  return max
end

bit = {}
bit.band = bit32.band
bit.bor = bit32.bor
bit.bxor = bit32.bxor
bit.lshift = bit32.lshift
bit.rshift = bit32.rshift
bit.arshift = bit32.arshift
bit.bnot = bit32.bnot
bit.rol = bit32.lrotate
bit.ror = bit32.rrotate
function bit.tobit(x)
  x = x % 4294967296
  if x >= 2147483648 then x = x - 4294967296 end
  return x
end
function bit.tohex(x, n)
  n = n or 8
  if n < 0 then
    return string.format("%0" .. (-n) .. "X", bit32.band(x, 0xFFFFFFFF))
  end
  return string.format("%0" .. n .. "x", bit32.band(x, 0xFFFFFFFF))
end
package.loaded.bit = bit

-- En LuaJIT, «%x» en el texto de reemplazo de gsub es la letra x; Lua 5.2 da error.
do
  local rawgsub = string.gsub
  local function normalizeReplacement(repl)
    if not string.find(repl, "%", 1, true) then return repl end
    local out, i, n = {}, 1, #repl
    while i <= n do
      local c = string.sub(repl, i, i)
      if c == "%" then
        local nextChar = string.sub(repl, i + 1, i + 1)
        if nextChar == "" then
          out[#out + 1] = "%%"
          i = i + 1
        elseif nextChar == "%" or string.match(nextChar, "%d") then
          out[#out + 1] = c .. nextChar
          i = i + 2
        else
          out[#out + 1] = nextChar
          i = i + 2
        end
      else
        out[#out + 1] = c
        i = i + 1
      end
    end
    return table.concat(out)
  end
  string.gsub = function(s, pattern, repl, n)
    if type(repl) == "string" then
      return rawgsub(s, pattern, normalizeReplacement(repl), n)
    end
    return rawgsub(s, pattern, repl, n)
  end
end

-- LuaJIT acepta infinito o números enormes en «%d»; Lua 5.2 da error. Se recortan.
do
  local rawformat = string.format
  local LIMIT = 9007199254740991
  local INTEGER = { d = true, i = true, x = true, X = true, o = true, u = true, c = true }
  local function fixInteger(value)
    if type(value) ~= "number" then return value end
    if value ~= value then return 0 end
    if value >= LIMIT then return LIMIT end
    if value <= -LIMIT then return -LIMIT end
    return value
  end
  string.format = function(fmt, ...)
    if type(fmt) ~= "string" or not fmt:find("%%[-+ #0]*%d*%.?%d*[dixXouc]") then
      return rawformat(fmt, ...)
    end
    local n = select("#", ...)
    local args = { ... }
    local index = 0
    for _, conversion in fmt:gmatch("%%([-+ #0]*%d*%.?%d*)([%a%%])") do
      if conversion ~= "%" then
        index = index + 1
        if INTEGER[conversion] then args[index] = fixInteger(args[index]) end
      end
    end
    return rawformat(fmt, unpack(args, 1, n))
  end
end

-- PoB2 solo usa lua-utf8 para separar miles en números (ASCII).
do
  local utf8mod = {}
  for _, name in ipairs({ "reverse", "gsub", "find", "sub", "match", "len", "byte", "char", "gmatch", "format", "rep", "lower", "upper" }) do
    utf8mod[name] = string[name]
  end
  function utf8mod.next(s, i, step)
    step = step or 1
    local pos = i
    if step > 0 then
      for _ = 1, step do
        if pos > #s then return nil end
        pos = pos + 1
      end
    else
      for _ = 1, -step do
        if pos <= 0 then return nil end
        pos = pos - 1
      end
    end
    return pos
  end
  package.preload["lua-utf8"] = function() return utf8mod end
end

return "boot"
