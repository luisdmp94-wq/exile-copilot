import { describe, expect, it } from "vitest";
import { toStandardLua } from "../../scripts/lib/luaCompat.js";

const rewrite = (code: string) => toStandardLua(code).code;

describe("el Lua de PoB2 → Lua 5.2", () => {
  it("las asignaciones compuestas se escriben largas, con la expresión entre paréntesis", () => {
    expect(rewrite("count += 1")).toBe("count = count + (1)");
    expect(rewrite("limit.count += count")).toBe("limit.count = limit.count + (count)");
    expect(rewrite("disabledRuneLines[strippedModLine] -= 1")).toBe(
      "disabledRuneLines[strippedModLine] = disabledRuneLines[strippedModLine] - (1)",
    );
    expect(rewrite('url ..= "/" .. league')).toBe('url = url .. ("/" .. league)');
    expect(rewrite("y += self.controls.a:IsShown() and 24 or 0")).toBe("y = y + (self.controls.a:IsShown() and 24 or 0)");
  });

  it("varias en una línea, sin tragarse el elseif ni el end", () => {
    expect(rewrite('if c == "{" then depth += 1 elseif c == "}" then depth -= 1 end')).toBe(
      'if c == "{" then depth = depth + (1) elseif c == "}" then depth = depth - (1) end',
    );
    expect(rewrite("for _ in s:gmatch(\"\\n\") do line += 1 end")).toBe("for _ in s:gmatch(\"\\n\") do line = line + (1) end");
  });

  it("«continue» salta a una etiqueta al final de su bucle", () => {
    const code = ["for i = 1, 3 do", "  if i == 2 then", "    continue", "  end", "  print(i)", "end"].join("\n");
    expect(rewrite(code)).toBe(
      ["for i = 1, 3 do", "  if i == 2 then", "    goto __continue_1", "  end", "  print(i)", "::__continue_1:: end"].join("\n"),
    );
    expect(rewrite("for _, g in ipairs(list) do if not g then continue end use(g) end")).toBe(
      "for _, g in ipairs(list) do if not g then goto __continue_1 end use(g) ::__continue_1:: end",
    );
  });

  it("no toca «goto continue» ni la etiqueta «::continue::» que ya son Lua normal", () => {
    const code = "for i = 1, 2 do\n  goto continue\n  ::continue::\nend";
    expect(rewrite(code)).toBe(code);
  });

  it("el acceso opcional da nil si la base es nil, y corta toda la cadena", () => {
    expect(rewrite("local x = gem.gemData?.gameId")).toBe(
      "local x = (function(__v) if __v == nil then return nil end return __v.gameId end)(gem.gemData)",
    );
    expect(rewrite("local t = SkillType?.[map[k]]")).toBe(
      "local t = (function(__v) if __v == nil then return nil end return __v[map[k]] end)(SkillType)",
    );
    expect(rewrite("if g.gemData?.grantedEffect.support then end")).toBe(
      "if (function(__v) if __v == nil then return nil end return __v.grantedEffect.support end)(g.gemData) then end",
    );
  });

  it("las funciones cortas son funciones normales", () => {
    expect(rewrite("local mt = { __index = |_, key| -> a[key] or b[key] }")).toBe(
      "local mt = { __index = function(_, key) return a[key] or b[key] end }",
    );
  });

  it("`local _ENV = nil` no apaga las globales (en LuaJIT no hacía nada)", () => {
    expect(rewrite("local _ENV = nil -- blocking globals")).toBe("local _ENV_luajit = nil -- blocking globals");
  });

  it("no cambia comentarios ni textos, y conserva las líneas", () => {
    const code = ['-- x += 1 en un comentario', 'local s = "a += b ?. c"', "--[[ continue ]]", "x += 2"].join("\n");
    const out = rewrite(code);
    expect(out.split("\n")).toHaveLength(4);
    expect(out).toContain('-- x += 1 en un comentario');
    expect(out).toContain('local s = "a += b ?. c"');
    expect(out).toContain("--[[ continue ]]");
    expect(out.endsWith("x = x + (2)")).toBe(true);
  });

  it("el código que ya es Lua estándar sale igual y sin cambios contados", () => {
    expect(toStandardLua("local a = 1 + 2\nreturn a")).toEqual({ code: "local a = 1 + 2\nreturn a", changes: 0 });
  });
});
