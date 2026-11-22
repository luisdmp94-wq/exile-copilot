/**
 * Path of Building 2 se escribe para su propio LuaJIT, que acepta cosas que el
 * Lua normal no entiende:
 *
 *   x += 1                       asignación compuesta (+= -= *= /= ..= %= ^=)
 *   continue                     saltar a la siguiente vuelta de un bucle
 *   a?.b  a?.[k]                 acceso que da nil si `a` es nil
 *   |a, b| -> expr               función corta
 *   local _ENV = nil             no hace nada en LuaJIT; en Lua 5.2 apaga las globales
 *
 * La web corre PoB2 en Lua 5.2 (WebAssembly), así que al empaquetarlo se
 * reescribe a Lua estándar. Las líneas se conservan: un error de PoB2 apunta a
 * la misma línea que en su repositorio.
 */

type TokenType = "name" | "keyword" | "number" | "string" | "symbol";

export interface Token {
  type: TokenType;
  v: string;
  start: number;
  end: number;
}

const KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "goto", "if", "in",
  "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while",
]);
const COMPOUND = new Set(["+=", "-=", "*=", "/=", "..=", "%=", "^="]);
const SYMBOLS = ["...", "..=", "..", "==", "~=", "<=", ">=", "::", "+=", "-=", "*=", "/=", "%=", "^=", "?.", "->"];
const BINOPS = new Set(["+", "-", "*", "/", "%", "^", "..", "==", "~=", "<", "<=", ">", ">=", "and", "or"]);
const OPEN: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const CLOSE: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

export class LuaCompatError extends Error {}

/** `src[i] === "["`: nivel de corchete largo (`[==[` → 2) o -1 si no lo es. */
function longBracketLevel(src: string, i: number): number {
  let j = i + 1;
  while (src[j] === "=") j++;
  return src[j] === "[" ? j - i - 1 : -1;
}

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\r" || c === "\n" || c === "\f" || c === "\v") {
      i++;
      continue;
    }
    if (c === "-" && src[i + 1] === "-") {
      if (src[i + 2] === "[") {
        const level = longBracketLevel(src, i + 2);
        if (level >= 0) {
          const close = `]${"=".repeat(level)}]`;
          const end = src.indexOf(close, i + 4 + level);
          i = end < 0 ? n : end + close.length;
          continue;
        }
      }
      const newline = src.indexOf("\n", i);
      i = newline < 0 ? n : newline;
      continue;
    }
    const start = i;
    if (c === "[") {
      const level = longBracketLevel(src, i);
      if (level >= 0) {
        const close = `]${"=".repeat(level)}]`;
        const end = src.indexOf(close, i + 2 + level);
        i = end < 0 ? n : end + close.length;
        tokens.push({ type: "string", v: src.slice(start, i), start, end: i });
        continue;
      }
    }
    if (c === '"' || c === "'") {
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === "\\") {
          i++;
          if (src[i] === "z") {
            i++;
            while (i < n && /\s/.test(src[i])) i++;
            continue;
          }
        }
        i++;
      }
      i++;
      tokens.push({ type: "string", v: src.slice(start, i), start, end: i });
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      if (c === "0" && (src[i + 1] === "x" || src[i + 1] === "X")) {
        i += 2;
        while (i < n && /[0-9a-fA-F.pP]/.test(src[i])) {
          if ((src[i] === "p" || src[i] === "P") && (src[i + 1] === "+" || src[i + 1] === "-")) i++;
          i++;
        }
      } else {
        while (i < n && /[0-9.eE]/.test(src[i])) {
          if ((src[i] === "e" || src[i] === "E") && (src[i + 1] === "+" || src[i + 1] === "-")) i++;
          i++;
        }
      }
      while (i < n && /[uUlLiI]/.test(src[i])) i++;
      tokens.push({ type: "number", v: src.slice(start, i), start, end: i });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      while (i < n && /[A-Za-z0-9_]/.test(src[i])) i++;
      const v = src.slice(start, i);
      tokens.push({ type: KEYWORDS.has(v) ? "keyword" : "name", v, start, end: i });
      continue;
    }
    const v = SYMBOLS.find((symbol) => src.startsWith(symbol, i)) ?? c;
    i += v.length;
    tokens.push({ type: "symbol", v, start, end: i });
  }
  return tokens;
}

function isSymbol(token: Token | undefined, value: string): boolean {
  return token !== undefined && token.type === "symbol" && token.v === value;
}

function matchForward(tokens: Token[], k: number): number {
  const open = tokens[k].v;
  const close = OPEN[open];
  let depth = 0;
  for (let j = k; j < tokens.length; j++) {
    if (isSymbol(tokens[j], open)) depth++;
    else if (isSymbol(tokens[j], close)) {
      depth--;
      if (depth === 0) return j;
    }
  }
  throw new LuaCompatError(`«${open}» sin cerrar`);
}

function matchBackward(tokens: Token[], k: number): number {
  const close = tokens[k].v;
  const open = CLOSE[close];
  let depth = 0;
  for (let j = k; j >= 0; j--) {
    if (isSymbol(tokens[j], close)) depth++;
    else if (isSymbol(tokens[j], open)) {
      depth--;
      if (depth === 0) return j;
    }
  }
  throw new LuaCompatError(`«${close}» sin abrir`);
}

/** `tokens[k]` es `function`: índice de su `end`. */
function matchFunctionEnd(tokens: Token[], k: number): number {
  let depth = 0;
  for (let j = k; j < tokens.length; j++) {
    const token = tokens[j];
    if (token.type !== "keyword") continue;
    // `while` y `for` abren con su `do`, que ya cuenta.
    if (token.v === "function" || token.v === "if" || token.v === "do" || token.v === "repeat") depth++;
    else if (token.v === "end" || token.v === "until") {
      depth--;
      if (depth === 0) return j;
    }
  }
  throw new LuaCompatError("«function» sin «end»");
}

/** Sufijos de una expresión (`.a`, `:b(...)`, `[k]`, `(...)`, `"s"`, `{...}`): índice tras el último. */
function suffixEnd(tokens: Token[], k: number): number {
  for (;;) {
    const token = tokens[k];
    if (!token) return k;
    if (token.type === "symbol" && (token.v === "." || token.v === ":" || token.v === "?.")) {
      k += isSymbol(tokens[k + 1], "[") ? 1 : 2;
      continue;
    }
    if (token.type === "symbol" && (token.v === "[" || token.v === "(" || token.v === "{")) {
      k = matchForward(tokens, k) + 1;
      continue;
    }
    if (token.type === "string") {
      k++;
      continue;
    }
    return k;
  }
}

function parseOperand(tokens: Token[], k: number): number {
  while (tokens[k] && (isSymbol(tokens[k], "-") || isSymbol(tokens[k], "#") || tokens[k].v === "not")) k++;
  const token = tokens[k];
  if (!token) throw new LuaCompatError("falta una expresión");
  if (token.type === "name" || token.type === "number" || token.type === "string") k++;
  else if (token.type === "keyword" && (token.v === "nil" || token.v === "true" || token.v === "false")) k++;
  else if (isSymbol(token, "...")) k++;
  else if (isSymbol(token, "(") || isSymbol(token, "{")) k = matchForward(tokens, k) + 1;
  else if (token.type === "keyword" && token.v === "function") k = matchFunctionEnd(tokens, k) + 1;
  else throw new LuaCompatError(`no esperaba «${token.v}»`);
  return suffixEnd(tokens, k);
}

function parseExpression(tokens: Token[], k: number): number {
  k = parseOperand(tokens, k);
  while (tokens[k] && tokens[k].type !== "string" && BINOPS.has(tokens[k].v)) k = parseOperand(tokens, k + 1);
  return k;
}

/** Inicio del lado izquierdo (`a.b[c]`) que acaba justo antes de `tokens[i]`. */
function leftSideStart(tokens: Token[], i: number): number {
  let j = i - 1;
  for (;;) {
    const token = tokens[j];
    if (!token) throw new LuaCompatError("falta el lado izquierdo");
    if (isSymbol(token, "]") || isSymbol(token, ")")) {
      j = matchBackward(tokens, j) - 1;
      continue;
    }
    if (token.type === "name") {
      const previous = tokens[j - 1];
      if (isSymbol(previous, ".") || isSymbol(previous, ":")) {
        j -= 2;
        continue;
      }
      return j;
    }
    throw new LuaCompatError(`lado izquierdo raro: «${token.v}»`);
  }
}

/** `a?.b.c` → una función que da nil si `a` es nil (corta toda la cadena, como en PoB2). */
function rewriteOptionalChain(src: string): string | null {
  const tokens = tokenize(src);
  const q = tokens.findIndex((token) => isSymbol(token, "?."));
  if (q < 0) return null;
  const base = leftSideStart(tokens, q);
  const end = suffixEnd(tokens, q);
  const baseText = src.slice(tokens[base].start, tokens[q - 1].end);
  const first = tokens[q + 1];
  const rest = (isSymbol(first, "[") ? "" : ".") + src.slice(first.start, tokens[end - 1].end);
  const text = `(function(__v) if __v == nil then return nil end return __v${rest} end)(${baseText})`;
  return src.slice(0, tokens[base].start) + text + src.slice(tokens[end - 1].end);
}

/** `|a, b| -> expr` → `function(a, b) return expr end`. */
function rewriteLambda(src: string): string | null {
  const tokens = tokenize(src);
  for (let i = 0; i < tokens.length; i++) {
    if (!isSymbol(tokens[i], "|")) continue;
    let j = i + 1;
    while (tokens[j] && !isSymbol(tokens[j], "|")) j++;
    if (!tokens[j] || !isSymbol(tokens[j + 1], "->")) continue;
    const params = src.slice(tokens[i].end, tokens[j].start);
    const end = parseExpression(tokens, j + 2);
    const body = src.slice(tokens[j + 2].start, tokens[end - 1].end);
    return `${src.slice(0, tokens[i].start)}function(${params}) return ${body} end${src.slice(tokens[end - 1].end)}`;
  }
  return null;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

const NEEDS_WORK = /(\+|-|\*|\/|\.\.|%|\^)=|\bcontinue\b|\?\.|->|local _ENV = nil/;

/** Código de PoB2 → Lua 5.2 estándar, y cuántos cambios ha hecho. */
export function toStandardLua(source: string): { code: string; changes: number } {
  if (!NEEDS_WORK.test(source)) return { code: source, changes: 0 };
  let src = source;
  let changes = 0;

  const withoutEnv = src.replace(/^(\s*)local _ENV = nil/m, "$1local _ENV_luajit = nil");
  if (withoutEnv !== src) {
    src = withoutEnv;
    changes++;
  }
  for (let next = rewriteOptionalChain(src); next !== null; next = rewriteOptionalChain(src)) {
    src = next;
    changes++;
  }
  for (let next = rewriteLambda(src); next !== null; next = rewriteLambda(src)) {
    src = next;
    changes++;
  }

  const tokens = tokenize(src);
  const edits: Edit[] = [];

  // Asignaciones compuestas: `a.b += c` → `a.b = a.b + (c)`.
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== "symbol" || !COMPOUND.has(token.v)) continue;
    const left = leftSideStart(tokens, i);
    const end = parseExpression(tokens, i + 1);
    const lhs = src.slice(tokens[left].start, tokens[i - 1].end);
    const rhs = src.slice(tokens[i + 1].start, tokens[end - 1].end);
    edits.push({ start: tokens[left].start, end: tokens[end - 1].end, text: `${lhs} = ${lhs} ${token.v.slice(0, -1)} (${rhs})` });
  }

  // `continue` como sentencia → `goto` a una etiqueta justo antes del `end` del bucle.
  interface Block {
    kind: "loop" | "do" | "function" | "if" | "repeat";
    label?: string;
  }
  const stack: Block[] = [];
  let pendingLoop = false;
  let labels = 0;
  const startsStatement = (previous: Token | undefined, start: number) => {
    if (!previous) return true;
    if (previous.type === "keyword" && (previous.v === "then" || previous.v === "else" || previous.v === "do")) return true;
    return src.slice(previous.end, start).includes("\n") && previous.v !== "goto" && previous.v !== "::";
  };
  const endsStatement = (next: Token | undefined, end: number) => {
    if (!next) return true;
    if (next.type === "keyword" && (next.v === "end" || next.v === "else" || next.v === "elseif")) return true;
    return src.slice(end, next.start).includes("\n") && next.v !== "::";
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === "keyword") {
      if (token.v === "while" || token.v === "for") pendingLoop = true;
      else if (token.v === "do") {
        stack.push({ kind: pendingLoop ? "loop" : "do" });
        pendingLoop = false;
      } else if (token.v === "function") stack.push({ kind: "function" });
      else if (token.v === "if") stack.push({ kind: "if" });
      else if (token.v === "repeat") stack.push({ kind: "repeat" });
      else if (token.v === "end" || token.v === "until") {
        const block = stack.pop();
        if (block?.label) {
          if (token.v === "until") throw new LuaCompatError("«continue» dentro de repeat…until");
          edits.push({ start: token.start, end: token.start, text: `::${block.label}:: ` });
        }
      }
      continue;
    }
    if (token.type !== "name" || token.v !== "continue") continue;
    const previous = tokens[i - 1];
    const next = tokens[i + 1];
    if (previous?.v === "goto" || previous?.v === "::" || next?.v === "::") continue;
    if (!startsStatement(previous, token.start) || !endsStatement(next, token.end)) continue;
    let target: Block | null = null;
    for (let s = stack.length - 1; s >= 0; s--) {
      if (stack[s].kind === "function") break;
      if (stack[s].kind === "loop" || stack[s].kind === "repeat") {
        target = stack[s];
        break;
      }
    }
    if (!target) throw new LuaCompatError("«continue» fuera de un bucle");
    target.label ??= `__continue_${++labels}`;
    edits.push({ start: token.start, end: token.end, text: `goto ${target.label}` });
  }

  if (edits.length === 0) return { code: src, changes };
  edits.sort((a, b) => b.start - a.start);
  let code = src;
  for (const edit of edits) code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
  return { code, changes: changes + edits.length };
}
