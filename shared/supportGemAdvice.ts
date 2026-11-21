import { z } from "zod";

/**
 * «¿Qué gema de asistencia le pongo a esta habilidad?»
 *
 * Las reglas filtran y eligen con los datos del juego (etiquetas, grado,
 * atributo, lo que dice la propia descripción de la asistencia y la build del
 * jugador). La IA, si está activa, solo redacta el porqué de lo ya elegido:
 * no puede proponer ni cambiar ninguna gema.
 */

export const GemAttributeSchema = z.enum(["Fue", "Des", "Int"]);
export type GemAttribute = z.infer<typeof GemAttributeSchema>;

export const GemSkillSchema = z.object({
  slug: z.string(),
  name: z.string(),
  /** `null` en las habilidades de dos atributos (ballesta, bastón, formas…). */
  attribute: GemAttributeSchema.nullable(),
  grade: z.number().int().nullable(),
  tags: z.array(z.string()),
  reserve: z.string().nullable(),
  description: z.string(),
  effects: z.array(z.string()),
});
export type GemSkill = z.infer<typeof GemSkillSchema>;

export const GemSupportSchema = GemSkillSchema.extend({
  // Una asistencia siempre tiene atributo: el jugador filtra por él.
  attribute: GemAttributeSchema,
  category: z.string().nullable(),
  lineage: z.boolean(),
  costMultiplier: z.string().nullable(),
});
export type GemSupport = z.infer<typeof GemSupportSchema>;

export const GemDataSchema = z.object({
  source: z.string(),
  fetchedAt: z.string(),
  skills: z.array(GemSkillSchema),
  supports: z.array(GemSupportSchema),
});
export type GemData = z.infer<typeof GemDataSchema>;

/**
 * Lo que la web ya sabe de la build del jugador (Expediente): el arquetipo que
 * escribió y lo que marcó como core o descartado en «Identidad de la build».
 * Es texto del jugador: orienta el orden, nunca es una instrucción.
 */
export const BuildContextSchema = z.object({
  archetype: z.string().trim().max(200).optional(),
  characterClass: z.string().trim().max(60).optional(),
  ascendancy: z.string().trim().max(60).optional(),
  core: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  discarded: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
});
export type BuildContext = z.infer<typeof BuildContextSchema>;

/** La build, traducida a lo que las reglas saben usar. */
export interface BuildTheme {
  /** Tipos de daño que nombra la build, como etiquetas del juego («Caos»). */
  elements: string[];
  /** La build se apoya en esbirros. */
  minions: boolean;
  /** Textos core y descartados, normalizados. */
  core: string[];
  discarded: string[];
}

const THEME_ELEMENTS: Array<[RegExp, string]> = [
  [/caos|chaos|veneno|poison/, "Caos"],
  [/fuego|fire|igni/, "Fuego"],
  [/hielo|frio|cold|escarcha|congel/, "Hielo"],
  [/rayo|lightning|electr/, "Rayo"],
  [/fisic|physical|sangrado|bleed/, "Físico"],
];

export function buildTheme(build: BuildContext | undefined | null): BuildTheme {
  const core = (build?.core ?? []).map(normalizeGemText);
  const text = normalizeGemText([build?.archetype ?? "", ...(build?.core ?? [])].join(" "));
  return {
    elements: THEME_ELEMENTS.filter(([pattern]) => pattern.test(text)).map(([, tag]) => tag),
    minions: /esbirro|invoca|minion|summon|esqueleto|skelet/.test(text),
    core,
    discarded: (build?.discarded ?? []).map(normalizeGemText),
  };
}

const NO_THEME: BuildTheme = { elements: [], minions: false, core: [], discarded: [] };

function mentions(labels: readonly string[], name: string): boolean {
  const wanted = normalizeGemText(name);
  return labels.some((label) => label.includes(wanted));
}

/** Cuánto sube una habilidad en el reparto por ser parte de la build. */
export function skillThemeBoost(skill: GemSkill, theme: BuildTheme): number {
  let boost = 0;
  if (mentions(theme.core, skill.name)) boost += 2;
  if (skill.tags.some((tag) => theme.elements.includes(tag))) boost += 2;
  if (theme.minions && skill.tags.includes("Esbirro")) boost += 1;
  return boost;
}

export interface SupportQuery {
  skill: GemSkill;
  /** Grado de la gema sin tallar: permite asistencias de ese grado o menor. */
  maxGrade: number;
  /** Atributos en los que al jugador le queda hueco de asistencia. */
  attributes: readonly GemAttribute[];
  /** Asistencias que esa habilidad ya lleva puestas. */
  socketed?: readonly string[];
  /** La build del jugador, si la web la conoce. */
  build?: BuildContext | null;
  /** Lo que el jugador cuenta que le pasa con la habilidad. */
  note?: string | null;
}

export interface SupportCandidate {
  support: GemSupport;
  /** Mayor = encaja mejor por etiquetas. Solo ordena; no es una medida de daño. */
  score: number;
}

/** Etiquetas que describen la asistencia pero no exigen nada a la habilidad. */
const SOFT_TAGS = new Set(["Duración", "Activación", "Compensación", "Condicional", "Linaje", "Sostenida", "Fases"]);
const ELEMENT_TAGS = new Set(["Físico", "Fuego", "Hielo", "Rayo", "Caos"]);

export function normalizeGemText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

function isPersistentMinion(skill: GemSkill): boolean {
  return skill.tags.includes("Esbirro") && skill.tags.includes("Persistente");
}

function isPersistentBuff(skill: GemSkill): boolean {
  return skill.tags.includes("Efecto beneficioso") && skill.tags.includes("Persistente");
}

function skillText(skill: GemSkill): string {
  return normalizeGemText(`${skill.name} ${skill.description} ${skill.effects.join(" ")}`);
}

/** ¿La habilidad golpea ella misma? Un daño «de X a Y» es un impacto; «por segundo» no. */
function hitsEnemies(skill: GemSkill): boolean {
  if (skill.tags.includes("Ataque")) return true;
  return skill.effects.some((effect) => /inflige de .+ a .+ de dano/.test(normalizeGemText(effect)));
}

/** ¿Alguna frase de la habilidad (descripción o efectos) dice eso? */
function saysInOneSentence(skill: GemSkill, pattern: RegExp): boolean {
  return [skill.description, ...skill.effects]
    .flatMap((part) => part.split(/(?<=\.)\s+/))
    .some((sentence) => pattern.test(normalizeGemText(sentence)));
}

/**
 * ¿La habilidad hace daño ella misma? Las maldiciones, las señales y los
 * efectos beneficiosos no: a esas no se les propone nada que solo dé daño.
 */
function dealsDamage(skill: GemSkill): boolean {
  if (skill.tags.includes("Ataque") || createsMinions(skill)) return true;
  return skill.effects.some((effect) => {
    const text = normalizeGemText(effect);
    if (/de dano .*por segundo/.test(text)) return true;
    // «Las repeticiones infligen un 50% menos de daño» (Aluvión) habla del daño
    // de otra habilidad: no es hacer daño.
    return /inflige[^|]*dano/.test(text) && !/% (?:mas|menos) de dano/.test(text);
  });
}

/** ¿Los proyectiles de la habilidad caen desde arriba? (Lluvia de flechas, Pararrayos…) */
function fallsFromAbove(skill: GemSkill): boolean {
  return saysInOneSentence(skill, /desde arriba|al aire|hacia el cielo/);
}

/** ¿La habilidad gasta eso al usarse o al impactar? («Consume una carga de frenesí».) */
function consumes(skill: GemSkill, what: string): boolean {
  return saysInOneSentence(skill, new RegExp(`(?:consum|gast)[^.]*${what}|${what}[^.]*se consum`));
}

/** ¿Algún efecto de la habilidad dura tan poco que, acortado, baja de un segundo? */
function hasVeryShortDuration(skill: GemSkill): boolean {
  return skill.effects.some((effect) => /dura[^|]*?\b(?:0\.\d+|1(?:\.[0-4])?) segundos?/.test(normalizeGemText(effect)));
}

/** «No puede encadenarse» y nada en la habilidad se encadena (Flecha paralizante). */
function cannotChain(skill: GemSkill): boolean {
  const text = skillText(skill);
  return /no puede encadenarse/.test(text) && !/se encadena/.test(text);
}

/** «No impacta, pero envenena como si impactara»: ni críticos, ni cegar, ni empujar. */
function neverHits(skill: GemSkill): boolean {
  return (
    skill.effects.some((effect) => /^no impacta/.test(normalizeGemText(effect))) &&
    !/explosi|explot|deton/.test(normalizeGemText(skill.description))
  );
}

/**
 * ¿La asistencia apaga justo lo que la habilidad hace bien? «Disparo de huida»
 * congela muchísimo: una asistencia que le impide congelar vale, pero no es lo
 * primero que hay que enseñar.
 */
function undoesWhatSkillDoes(supportText: string, skill: GemSkill): boolean {
  const own = skillText(skill);
  const freezes = /mas de acumulacion de congelamiento|puede escarchar o congelar/.test(own);
  const shocks = /mas de probabilidad de electrocutar|alta probabilidad de electrocut/.test(own);
  const ignites = /inflamabilidad|probabilidad de quemar/.test(own);
  const paralyzes = /acumul\w* paralisis/.test(own);
  if (freezes && /no pueden acumular congelamiento/.test(supportText)) return true;
  if (shocks && /no pueden aplicar electrocucion/.test(supportText)) return true;
  if (ignites && /no pueden quemar/.test(supportText)) return true;
  return (
    (freezes || shocks || ignites || paralyzes) &&
    /no pueden aplicar (?:estados alterados elementales|congelamiento, electrocucion ni quemadura)/.test(supportText)
  );
}

/**
 * ¿La habilidad pone esbirros en el campo? La etiqueta «Esbirro» no basta:
 * también la llevan las ofrendas, los pactos y los efectos que solo afectan a
 * los esbirros que ya tienes. A esas no les vale «Frenesí voraz» ni nada que
 * mejore «los esbirros de la habilidad asistida».
 */
function createsMinions(skill: GemSkill): boolean {
  if (!skill.tags.includes("Esbirro")) return false;
  if (normalizeGemText(skill.name).startsWith("ofrenda")) return false;
  if (skill.tags.includes("Compañero")) return true;
  if (skill.tags.includes("Persistente") && !skill.tags.includes("Efecto beneficioso")) return true;
  return saysInOneSentence(skill, /\binvoc\w+|\bcre(?:a|as|ar) (?:un |una )?(?:zombi|enjambres?|esbirros?)/);
}

/** Lo que la asistencia quita («no pueden quemar»), en español o en inglés. */
const TAKES_AWAY = /\bno (?:pueden|puede|infligen)\b|\bcannot\b|\bcan't\b|\bdeal no\b/i;

/**
 * Lo que la asistencia da, en una línea. El primer efecto de la gema es a
 * veces lo que quita; se busca el primero que diga lo que aporta y, si todos
 * son restricciones, se cuenta con su descripción.
 */
export function supportMainBenefit(support: { effects: readonly string[]; description: string }): string {
  const benefit = support.effects.find((effect) => !TAKES_AWAY.test(effect));
  if (benefit !== undefined) return benefit;
  // La descripción empieza diciendo a qué asiste; lo que hace viene después.
  const sentences = support.description.split(/(?<=\.)\s+/).filter(Boolean);
  if (sentences.length > 1 && /^(?:asiste|supports)\b/i.test(sentences[0])) return sentences[1];
  return support.description || support.effects[0] || "";
}

/** Familia de la asistencia: «Lanzamiento rápido I» y «II» comparten hueco. */
export function supportFamily(support: GemSupport): string {
  return support.category ?? support.name.replace(/\s+[IVX]+$/, "");
}

/**
 * Asistencias que solo sirven a un tipo concreto de habilidad. Si la primera
 * frase de la asistencia nombra ese tipo, la habilidad tiene que serlo (por
 * etiqueta) o hablar de ello en su propio texto.
 */
const KEYWORD_RULES: Array<[RegExp, (skill: GemSkill, text: string) => boolean]> = [
  [/habilidades de maldicion/, (skill) => skill.tags.includes("Maldición")],
  [/habilidades de viaje/, (skill) => skill.tags.includes("Viaje")],
  [/habilidades de canalizacion/, (skill) => skill.tags.includes("Canalización")],
  [/metahabilidades/, (skill) => skill.tags.includes("Metahabilidad")],
  [/gritos de guerra/, (skill) => skill.tags.includes("Grito de guerra")],
  [/habilidades de senales/, (skill) => skill.tags.includes("Señal")],
  [/repetibles/, (skill) => skill.tags.includes("Repetible")],
  // «De escudo» es la que se usa con el escudo en la mano, no la que crea un escudo.
  [/habilidades de escudo/, (skill) => saysInOneSentence(skill, /tu escudo(?! de energia)|en el escudo|ataques de escudo/)],
  [/cascadeables/, (_skill, text) => text.includes("cascad")],
  [/estandarte/, (_skill, text) => text.includes("estandarte")],
  // Cargas de poder, frenesí o aguante: «recarga» y «descarga» no cuentan.
  [
    /consum\w* cargas/,
    (skill) => saysInOneSentence(skill, /(?:consum|gast)\w*[^.]*cargas? de (?:poder|frenesi|aguante)/),
  ],
  [
    /gener\w* cargas/,
    (skill) => saysInOneSentence(skill, /(?:otorg|gan|recib)\w*[^.]*cargas? de (?:poder|frenesi|aguante)/),
  ],
  // Potenciar otra habilidad («potencia los siguientes ataques»), no una resistencia.
  [
    /potenciar otras habilidades/,
    (skill) => saysInOneSentence(skill, /potencia[rn]? (?:los|tus|tu|el) (?:siguientes? )?(?:ataques?|embates?|hechizos?)/),
  ],
  [/rotura de armadura/, (_skill, text) => text.includes("armadura")],
  [/ralentizaciones/, (_skill, text) => /ralentiz|escalofri|congel/.test(text)],
  // De ballesta es la que lo dice al presentarse: «Disparo de tornado» solo
  // cuenta que succiona las saetas de ballesta que le disparen.
  [
    /municion|ballesta/,
    (skill) =>
      skill.tags.includes("Munición") ||
      /municion|ballesta/.test(normalizeGemText(`${skill.name} ${skill.description.split(".")[0] ?? ""}`)),
  ],
  [/que no apuntan al suelo/, (skill) => !fallsFromAbove(skill) && !saysInOneSentence(skill, /\bal suelo\b/)],
  // Lo que sigue se colaba a casi todas las habilidades porque no había regla.
  [/tiempo de detonacion|que detonan (?:cuando|despues)/, (_skill, text) => text.includes("tiempo de detonacion")],
  [/habilidades de ofrenda/, (skill) => normalizeGemText(skill.name).startsWith("ofrenda")],
  [
    /consumen cadaveres/,
    (skill) => saysInOneSentence(skill, /consum\w* (?:un |varios |hasta \d+ |el |los )?cadaver|cadaver se consume/),
  ],
  [/momento perfecto/, (_skill, text) => text.includes("momento perfecto")],
  [/habilidades de nova/, (skill) => skill.tags.includes("Nova")],
  [/requieren que se cumpla alguna condicion/, (skill) => skill.tags.includes("Condicional")],
  [/que activan otras habilidades/, (skill) => skill.tags.includes("Activación")],
  [/de conjuracion/, (skill) => skill.tags.includes("Conjuración")],
  // Los datos no dicen qué habilidades se pueden usar andando: solo si lo dice su texto.
  [/usar en movimiento|usar mientras te mueves/, (_skill, text) => /usar(?:se)? (?:en movimiento|mientras te mueves)/.test(text)],
  [/saltar en el aire/, (skill) => saysInOneSentence(skill, /\bsaltas? (?:por los aires|en el aire)/)],
  [/aplican exposicion/, (_skill, text) => text.includes("exposicion")],
  [/objetos que se destruyen/, (_skill, text) => text.includes("lo destruye")],
  [/objetos de tierra/, (_skill, text) => text.includes("de tierra")],
  [/golpe final/, (_skill, text) => /golpe final|combinacion de (?:hasta )?\w+ ataques/.test(text)],
  [/de arco o lanza/, (_skill, text) => /\barco\b|flecha|lanza/.test(text)],
  // «Ataques de lanza»: la habilidad tiene que hablar del arma, no del verbo lanzar.
  [/ataques de lanza/, (_skill, text) => /\b(?:tu|la|una|de|con) lanza\b|lanzada|lanzazo|jabalina/.test(text)],
  [/ataques de arco/, (_skill, text) => /\barco\b|flecha/.test(text)],
  [/^asiste habilidades de viento/, (skill) => skill.tags.includes("Viento")],
  // Daño degenerativo propio («por segundo»), no el de quemaduras o venenos.
  [/dano (?:de caos )?degenerativo/, (skill) => dealsDamageOverTime(skill)],
];

/** La asistencia exige que la habilidad haga daño o impacte. */
const NEEDS_DAMAGE =
  /que impact(?:e|an)|pued(?:a|e|en) impactar|impactos daninos|infligir impactos|provocan impactos|inflij(?:a|an) dano|infligen dano|infligir dano/;

/** Lo único que da la asistencia es daño (a veces a cambio de otra cosa). */
const ONLY_GIVES_DAMAGE = /% mas de dano|dano mayor|inflij(?:a|an) mas dano|mas dano/;

/**
 * Lo que la asistencia dice que no puede asistir («No puede asistir
 * habilidades de canalización») y cómo se reconoce eso en la habilidad.
 */
const CANNOT_SUPPORT: Array<[RegExp, (skill: GemSkill, text: string) => boolean]> = [
  [/de canalizacion/, (skill) => skill.tags.includes("Canalización")],
  [/habilidades persistentes/, (skill) => skill.tags.includes("Persistente")],
  [/metahabilidades/, (skill) => skill.tags.includes("Metahabilidad")],
  [/de (?:los )?totems/, (skill) => skill.tags.includes("Tótem")],
  [/habilidades de (?:los )?esbirros/, (skill) => skill.tags.includes("Esbirro")],
  [/de salto/, (skill) => saysInOneSentence(skill, /\bsaltas (?:hacia|por|en|sobre)/)],
  [/proyectiles desde arriba/, (skill) => fallsFromAbove(skill)],
  [/no puedan encadenarse/, (skill) => cannotChain(skill)],
  [/enfriamiento/, (_skill, text) => /enfriamiento|tiempo de recarga/.test(text)],
  [/combo/, (_skill, text) => /\bcombo\b/.test(text)],
  [/sellos/, (_skill, text) => /\bsellos?\b/.test(text)],
  [/fisuras/, (_skill, text) => text.includes("fisura")],
  [/consum\w+ cargas de frenesi/, (skill) => consumes(skill, "cargas? de frenesi")],
  [/consum\w+ cargas de aguante/, (skill) => consumes(skill, "cargas? de aguante")],
  [/consum\w+ cargas de poder/, (skill) => consumes(skill, "cargas? de poder")],
  [/consum\w+ [^.]*congelamiento/, (skill) => consumes(skill, "congelamiento")],
  [/consum\w+ [^.]*quemadura/, (skill) => consumes(skill, "quemadura")],
  [/consum\w+ [^.]*armadura/, (skill) => consumes(skill, "armadura")],
  [/consum\w+ [^.]*parado/, (skill) => consumes(skill, "parado")],
  [/consum\w+ [^.]*sangrado/, (skill) => consumes(skill, "(?:sangrado|perdida de sangre)")],
  [
    /consum\w+ [^.]*estados alterados elementales/,
    (skill) => consumes(skill, "(?:congelamiento|electrocucion|quemadura)"),
  ],
];

/** Lo que la propia descripción de la asistencia exige a la habilidad. */
function textRulesAllow(support: GemSupport, skill: GemSkill): boolean {
  const text = normalizeGemText(support.description);
  const first = text.split(".")[0] ?? text;
  const tags = skill.tags;
  const own = skillText(skill);
  const everything = `${text} ${normalizeGemText(support.effects.join(" "))}`;

  // Lo que la asistencia avisa de que no asiste.
  const cannot = text
    .split(/(?<=\.)\s+/)
    .filter((sentence) => /^no (?:puede asistir|asiste)/.test(sentence))
    .join(" ");
  if (cannot !== "" && CANNOT_SUPPORT.some(([pattern, matches]) => pattern.test(cannot) && matches(skill, own))) return false;

  // Lo que la propia habilidad no admite.
  if (/cantidad de proyectiles no se puede modificar/.test(own) && /proyectil(?:es)? adicional/.test(everything)) return false;
  if (/no puedes perforar/.test(own) && /perfor/.test(everything)) return false;
  if (cannotChain(skill) && /encaden/.test(everything)) return false;
  if (neverHits(skill) && /impact/.test(first) && !/venen/.test(everything)) return false;

  // La asistencia le quita a la habilidad justo lo que da (cargas de frenesí).
  if (/no pueden generar cargas de frenesi/.test(everything) && saysInOneSentence(skill, /otorg\w*[^.]*cargas? de frenesi/)) {
    return false;
  }
  // Daño cuerpo a cuerpo para algo que no pega cuerpo a cuerpo.
  if (/mas de dano (?:fisico )?cuerpo a cuerpo/.test(everything) && !tags.includes("Cuerpo a cuerpo")) return false;
  // Lo único que da es daño degenerativo propio («por segundo»): la habilidad tiene que tenerlo.
  if (
    /dano degenerativo(?: de las habilidades asistidas)? que no (?:sea|es|provenga|proviene|se aplico)/.test(everything) &&
    !dealsDamageOverTime(skill)
  ) {
    return false;
  }
  // «Aflicción veloz III» solo paga si el efecto dura menos de un segundo.
  if (/duracion (?:es )?inferior a un segundo/.test(everything) && !hasVeryShortDuration(skill)) return false;
  // Una señal se usa, pero lo que pega es lo que desencadena: eso no «lo usas tú mismo».
  if (tags.includes("Señal") && /que usas tu mismo/.test(first) && /impact|ataque/.test(first)) return false;

  if (/^asiste embates/.test(first) && !tags.includes("Embate")) return false;
  if (/^asiste hechizos/.test(first) && !tags.includes("Hechizo")) return false;
  // Un hechizo que prepara ataques («Flechas de punta helada»): lo que pega es
  // el ataque, así que el daño de hechizos no le sirve.
  if (
    /^asiste (?:habilidades de )?hechizos/.test(first) &&
    tags.includes("Ataque") &&
    (NEEDS_DAMAGE.test(first) || ONLY_GIVES_DAMAGE.test(everything))
  ) {
    return false;
  }
  if (/^asiste (?:ataques|golpes|habilidades de ataque|habilidades de golpe)/.test(first) && !tags.includes("Ataque")) return false;
  // Lo persistente (esbirros que reviven, auras, efectos que se dejan puestos) no «se usa».
  if (/que (?:usas|uses|lanzas)(?: o activ[ae]s)? tu mismo/.test(first) && tags.includes("Persistente")) return false;
  if (/reserven espiritu/.test(text) && (skill.reserve !== null || tags.includes("Persistente"))) return false;
  if (/que tengan? una duracion/.test(first) && !tags.includes("Duración")) return false;
  if (/que tien(?:e|en) un limite/.test(first) && !/limite/.test(skillText(skill))) return false;
  // Enfriamiento de verdad: «los modificadores de recuperación del enfriamiento
  // también se aplican a…» (Momento de necesidad) no es tener uno.
  const ownWithoutCooldownModifiers = own.replace(/modificadores de velocidad de recuperacion del enfriamiento/g, "");
  if (/que tengan? enfriamiento/.test(first) && !/enfriamiento|tiempo de recarga/.test(ownWithoutCooldownModifiers)) return false;

  // Un par de asistencias no dicen a qué habilidades asisten (su texto solo
  // describe el efecto). Sin saberlo no se proponen.
  if (text !== "" && !first.startsWith("asiste")) return false;

  // ¿La asistencia está hecha para el tipo de esta habilidad (de ofrenda, de maldición…)?
  let madeForThisType = support.tags.some((tag) => tag === "Maldición" || tag === "Señal");
  for (const [condition, allows] of KEYWORD_RULES) {
    if (!condition.test(first)) continue;
    if (!allows(skill, skillText(skill))) return false;
    madeForThisType = true;
  }

  // Lo que mejora «los esbirros de la habilidad asistida» pide una habilidad que
  // los cree: una ofrenda lleva la etiqueta de esbirro, pero no pone ninguno.
  if (
    /que (?:crean?|creen?|invocan?|generan?) (?:esbirros|companeros)|los esbirros de las? habilidad(?:es)? asistidas?/.test(everything) &&
    !createsMinions(skill)
  ) {
    return false;
  }

  if (NEEDS_DAMAGE.test(first)) {
    if (isPersistentBuff(skill) || !dealsDamage(skill)) return false;
    if (/impact/.test(first) && !isPersistentMinion(skill) && !hitsEnemies(skill)) return false;
  }
  // A una maldición o a un aura no se le propone «Área concentrada»: le encoge
  // el área a cambio de un daño que no hace. Las hechas para ese tipo de
  // habilidad (de maldición, de señal, de ofrenda) sí pasan.
  if (!dealsDamage(skill) && !isPersistentBuff(skill) && !madeForThisType && ONLY_GIVES_DAMAGE.test(everything)) {
    return false;
  }

  // «Asiste habilidades que crean muros / fisuras / superficies…»: la habilidad
  // tiene que hablar de eso mismo. Lo que ya cubren las etiquetas se salta.
  const creates = /que (?:crean?|creen?) ([a-zñ]+)/.exec(first);
  if (creates) {
    const noun = creates[1];
    // «objetos» tiene su propia regla arriba («objeto» se colaba por «objetivo»).
    const coveredByTags = /^(?:esbirros|proyectiles|totems|remanentes|objetos)$/.test(noun);
    if (!coveredByTags && !skillText(skill).includes(noun.slice(0, 5))) return false;
  }
  return true;
}

/** Metahabilidad que se deja activa (Blasfemia, «Lanzar al…»): ni se usa ni pega ella misma. */
function isPersistentMeta(skill: GemSkill): boolean {
  return skill.tags.includes("Metahabilidad") && isPersistentBuff(skill);
}

/** ¿La asistencia está hecha para metahabilidades o para lo que activan? */
function targetsMeta(support: GemSupport): boolean {
  const first = normalizeGemText(support.description).split(".")[0] ?? "";
  return /metahabilidades|que activan otras habilidades/.test(first);
}

/**
 * Una metahabilidad activa tiene muy pocas etiquetas, y con las reglas
 * generales se colaba casi todo: a Blasfemia se le llegó a recomendar «Área
 * concentrada», que le encoge el aura a cambio de un daño que no hace. Aquí
 * solo pasa lo que seguro le vale; ante la duda, no se propone.
 */
function appliesToPersistentMeta(support: GemSupport, skill: GemSkill): boolean {
  const text = normalizeGemText(`${support.description} ${support.effects.join(" ")}`);
  const first = normalizeGemText(support.description).split(".")[0] ?? "";
  if (/no puede asistir habilidades persistentes/.test(text)) return false;
  // 1. Las hechas para efectos beneficiosos persistentes valen para cualquiera de ellos.
  //    Siguen pasando por lo que exige su propio texto (las de estandartes, solo a estandartes).
  if (support.tags.includes("Efecto beneficioso") && support.tags.includes("Persistente")) return textRulesAllow(support, skill);
  // 2. Las que asisten metahabilidades o lo que activan. Si hablan de energía
  //    o de conjuración, la gema tiene que usar eso mismo (Blasfemia no usa energía).
  if (targetsMeta(support)) {
    if (/energia/.test(text) && !/energia/.test(skillText(skill))) return false;
    if (/de conjuracion/.test(first) && !skill.tags.includes("Conjuración")) return false;
    if (/que activan otras habilidades/.test(first) && !skill.tags.includes("Activación")) return false;
    return true;
  }
  // 3. Blasfemia: lo que hace más fuerte la maldición engarzada sin depender de
  //    lanzarla, de su demora ni de su duración (como aura no tiene nada de eso).
  if (socketedKind(skill) === "curse") {
    return (
      support.tags.includes("Maldición") &&
      /^asiste (?:habilidades de maldicion|maldiciones)/.test(first) &&
      /magnitud/.test(text) &&
      !/lanzas tu mismo|demora|duracion|suelo maldito/.test(text)
    );
  }
  return false;
}

function supportApplies(support: GemSupport, skill: GemSkill): boolean {
  if (support.lineage) return false;
  if (isPersistentMeta(skill)) return appliesToPersistentMeta(support, skill);
  // Los esbirros que reviven solo aceptan con seguridad asistencias de esbirros.
  if (isPersistentMinion(skill) && !support.tags.includes("Esbirro")) return false;
  // Una asistencia de señales vale para cualquier señal: sus otras etiquetas
  // («Físico», «Hechizo») describen lo que añade, no lo que pide.
  const madeForMarks = support.tags.includes("Señal") && skill.tags.includes("Señal");
  for (const tag of support.tags) {
    if (SOFT_TAGS.has(tag)) continue;
    if (madeForMarks && tag !== "Señal") continue;
    if (!skill.tags.includes(tag)) return false;
  }
  return textRulesAllow(support, skill);
}

/** ¿El daño de la habilidad es sobre todo «por segundo»? (Contagio, Drenar esencia…) */
function dealsDamageOverTime(skill: GemSkill): boolean {
  return skill.effects.some((effect) => /de dano .*por segundo/.test(normalizeGemText(effect)));
}

/**
 * Orden orientativo de las candidatas. Sube lo que da daño de verdad («un 30%
 * más de daño») y lo que encaja con el tipo de daño de la habilidad; baja lo
 * que encarece. No mide daño: solo decide qué se enseña primero.
 */
/**
 * Problemas que el jugador suele contar y qué asistencias los arreglan. Si su
 * nota habla de uno, las asistencias que lo resuelven suben.
 */
const NOTE_NEEDS: Array<[RegExp, RegExp]> = [
  [/muer|aguant|sobreviv|caen|duran poco|\bdie|dying|surviv|tank|squishy/, /sig(?:a|ue)n? peleando|menos de dano recibido|menos dano recibido|resistencias|vida maxima/],
  [/mana|cuesta|caro|\bcost|expensive/, /menos de costo|regeneracion de mana/],
  [/poco dano|pega poco|no mata|mas dano|jefe|low damage|more damage|weak|\bboss/, /% mas de dano/],
  [/lento|tarda|velocidad|\bslow|speed/, /velocidad de lanzamiento|velocidad de ataque|velocidad de habilidad/],
  [/area|grupo|muchos enemigos|limpiar|\bpacks?\b|clear/, /area de efecto aumentada|proyectiles adicionales|se propaga/],
];

function noteBoost(text: string, note: string): number {
  return NOTE_NEEDS.some(([need, fix]) => need.test(note) && fix.test(text)) ? 4 : 0;
}

function scoreSupport(support: GemSupport, skill: GemSkill, theme: BuildTheme, note: string): number {
  const text = normalizeGemText(`${support.description} ${support.effects.join(" ")}`);
  let score = note ? noteBoost(text, note) : 0;
  // En una metahabilidad manda lo que mejora lo que lleva engarzado (la
  // maldición de Blasfemia) y después lo que está hecho para metahabilidades.
  if (isPersistentMeta(skill)) {
    if (support.tags.includes("Maldición")) score += 5;
    else if (targetsMeta(support)) score += 3;
  }
  for (const tag of support.tags) {
    if (SOFT_TAGS.has(tag) || !skill.tags.includes(tag)) continue;
    score += ELEMENT_TAGS.has(tag) ? 3 : 1;
  }
  if (/% mas de dano|mas dano/.test(text)) score += 2;
  if (dealsDamageOverTime(skill) && /degenerativo/.test(text)) score += 3;
  if (support.costMultiplier) score -= 1;
  // Una mejora que solo funciona a veces (hace falta un cadáver, el maná lleno,
  // estar quieto, que el enemigo tenga poca vida…) vale menos que una fija.
  if (/cadaver|a menos que|mientras tengas|mientras estes|si has |vida baja|vida llena/.test(text)) score -= 2;
  // «Un 4% más de daño por cada tipo de carga o infusión que tengas» no da
  // nada a quien no lleva cargas ni infusiones encima, que es casi cualquier
  // novato, y la web no sabe si las lleva (caso real, 20-11-2026: «Inhibidor»
  // salía la primera para Descarga de caos). Sigue entre las que valen.
  if (/por cada (?:tipo diferente de )?(?:cargas?|infusion[a-z]*)[^.|]*que tengas/.test(text)) score -= 4;
  // Y una que quita daño a cambio de otra cosa, menos todavía.
  if (/% menos de dano/.test(text)) score -= 3;
  // Encoger el área de toda la habilidad («un 50% menos de área de efecto») es
  // un cambio que se nota en cada uso: más daño en el centro, pero se escapan
  // los grupos. Caso real (20-11-2026): «Área concentrada» salía la primera en
  // casi tres de cada diez habilidades. Sigue entre las que valen; si el
  // jugador pide daño o jefes, su nota la vuelve a subir, y si pide área, baja
  // más. Lo que solo encoge las réplicas o las fisuras ramificadas no cuenta.
  if (/asistidas tienen un \d+% menos de area de efecto(?! en las replicas)/.test(text)) {
    score -= 3;
    if (NOTE_NEEDS[4][0].test(note)) score -= 4;
  }
  // Una que le pone un enfriamiento largo a la habilidad la deja casi sin uso.
  if (/enfriamiento de \d+ segundos/.test(text)) score -= 4;
  // Pagar vida cada vez que usas la habilidad mata a quien no sabe sostenerlo
  // (caso real, 20-11-2026: «Extracción» en una Descarga de caos con 723 de
  // vida). Sigue saliendo entre las que valen, con su coste a la vista, pero
  // nunca como la primera.
  // Las hechas para ofrendas se libran: una ofrenda se lanza de vez en cuando,
  // no a cada golpe, y sacrificar es justo lo que hacen.
  const madeForOfferings = /habilidades de ofrenda/.test(normalizeGemText(support.description).split(".")[0] ?? "");
  if (/sacrific\w+ un \d+% de vida al usarse|pierdes un \d+% de tu vida/.test(text) && !madeForOfferings) score -= 6;
  // Lo mismo, más suave, con las que cambian el coste de maná por vida.
  if (/costos? de mana[^.|]*se convierten? en costos? de vida/.test(text)) score -= 3;
  // En una señal, primero lo que está hecho para señales.
  if (skill.tags.includes("Señal") && support.tags.includes("Señal")) score += 6;
  // Lo que premia pegar pegado al enemigo no es para quien dispara de lejos.
  if (/a menos de [\d.]+ metros? de ti/.test(text) && skill.tags.includes("Proyectil") && !skill.tags.includes("Cuerpo a cuerpo")) {
    score -= 4;
  }
  // Gastar furia solo sirve si el personaje la genera: sin pistas de eso, abajo.
  if (/(?:consum|gast)\w+ [^.|]*furia/.test(text) && !/\bfuria\b/.test(skillText(skill))) score -= 3;
  // Lo mismo con el combo: sin una habilidad que hable de combo, una asistencia
  // que vive de él no es lo primero que hay que enseñar.
  if (/\bcombo\b/.test(text) && !/\bcombo\b/.test(skillText(skill))) score -= 3;
  // Y la que deja la habilidad sin poder usarse hasta cumplir algo («requieren
  // 5 de combo para usarse») no puede salir primera para un ataque principal.
  if (/no se pueden usar (?:hasta|a menos)|requieren \d+ de combo para usarse|se vuelven utilizables/.test(text)) score -= 4;
  // Las que mejoran algo a cambio de quitarle a la habilidad una capacidad
  // («no pueden aplicar electrocución», «no pueden quemar») son para montar
  // una combinación con otra habilidad: no lo primero que enseñar a quien empieza.
  if (/asistid[ao]s? no pueden (?:aplicar|acumular|quemar|generar|romper|infligir impactos criticos)/.test(text)) score -= 2;
  // Rinde solo cuando estás a punto de quedar aturdido: vale, pero abajo.
  if (/tu barra de aturdimiento|cuanto mas cerca estes de quedar/.test(text)) score -= 2;
  // Lo que apaga justo lo que la habilidad hace bien (congelar, electrocutar…).
  if (undoesWhatSkillDoes(text, skill)) score -= 4;
  if (/no pueden consumir cargas/.test(text) && consumes(skill, "cargas? de (?:poder|frenesi|aguante)")) score -= 3;
  // Lo mismo con las infusiones: Chispa, Bola de fuego o Cometa consumen una
  // para su versión fuerte, y una asistencia que lo impide les quita eso.
  if (/no pueden consumir (?:cargas ni )?infusiones/.test(text) && consumes(skill, "infusion")) score -= 3;
  // Lo que escala con la inteligencia rinde poco en una gema que no es de inteligencia.
  if (/por cada 100 de inteligencia|equivalente a tu inteligencia/.test(text) && skill.attribute !== null && skill.attribute !== "Int") score -= 3;
  // Daño elemental para una habilidad que solo hace caos (veneno): no le llega.
  if (/mas de dano elemental/.test(text) && skill.tags.includes("Caos") && !skill.tags.some((tag) => tag === "Fuego" || tag === "Hielo" || tag === "Rayo")) {
    score -= 3;
  }
  // Las hechas para la mecánica de esta habilidad (gasta cargas, tiene
  // enfriamiento, potencia otros ataques, momento perfecto) van delante.
  const first = normalizeGemText(support.description).split(".")[0] ?? "";
  if (/consum\w* cargas|gener\w* cargas|potenciar otras habilidades|momento perfecto|que tengan? enfriamiento/.test(first)) score += 3;
  // Con una build declarada: lo que el jugador marcó como core sube, y una
  // asistencia de un tipo de daño que la build no usa (Brutalidad en un
  // personaje de caos) baja aunque técnicamente valga.
  if (mentions(theme.core, support.name)) score += 3;
  if (theme.elements.length > 0) {
    for (const tag of support.tags) {
      if (!ELEMENT_TAGS.has(tag)) continue;
      score += theme.elements.includes(tag) ? 1 : -3;
    }
  }
  return score;
}

/** Asistencias que las reglas dejan poner, ordenadas de más a menos afín. */
export function supportCandidates(data: GemData, query: SupportQuery): SupportCandidate[] {
  const socketed = new Set((query.socketed ?? []).map(normalizeGemText));
  // Un personaje importado trae los nombres en inglés: también se comparan con el identificador.
  const socketedFamilies = new Set(
    data.supports
      .filter(
        (support) =>
          socketed.has(normalizeGemText(support.name)) || socketed.has(normalizeGemText(support.slug.replace(/_/g, " "))),
      )
      .map(supportFamily),
  );
  const theme = query.build ? buildTheme(query.build) : NO_THEME;
  const best = new Map<string, GemSupport>();
  for (const support of data.supports) {
    if (support.grade === null || support.grade > query.maxGrade) continue;
    if (!query.attributes.includes(support.attribute)) continue;
    const family = supportFamily(support);
    if (socketedFamilies.has(family)) continue;
    // Lo que el jugador descartó en su build no se vuelve a proponer.
    if (mentions(theme.discarded, support.name) || mentions(theme.discarded, family)) continue;
    if (!supportApplies(support, query.skill)) continue;
    // De cada familia, solo la versión más alta que la gema permite tallar.
    const current = best.get(family);
    if (!current || (support.grade ?? 0) > (current.grade ?? 0)) best.set(family, support);
  }
  return [...best.values()]
    .map((support) => ({ support, score: scoreSupport(support, query.skill, theme, normalizeGemText(query.note ?? "")) }))
    .sort((a, b) => b.score - a.score || (b.support.grade ?? 0) - (a.support.grade ?? 0) || a.support.name.localeCompare(b.support.name, "es"));
}

/** Busca una habilidad por su nombre en español, sin tildes ni mayúsculas. */
export function findSkill(data: GemData, name: string): GemSkill | null {
  const wanted = normalizeGemText(name);
  if (!wanted) return null;
  return (
    data.skills.find((skill) => normalizeGemText(skill.name) === wanted) ??
    data.skills.find((skill) => normalizeGemText(skill.slug.replace(/_/g, " ")) === wanted) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Metahabilidades: gemas que llevan otras habilidades engarzadas
// ---------------------------------------------------------------------------

/**
 * Qué tipo de habilidad se le engarza a una metahabilidad. Blasfemia lleva
 * maldiciones; «Lanzar al infligir estado alterado elemental», hechizos. Sin
 * eso la gema no hace nada, así que aconsejar solo su asistencia deja al
 * jugador a medias.
 */
export const SocketedKindSchema = z.enum(["curse", "spell", "ranged-attack", "mace-skill", "skill"]);
export type SocketedKind = z.infer<typeof SocketedKindSchema>;

/** Lo que la propia descripción de la gema dice que lleva engarzado. */
const SOCKETED_KINDS: Array<[RegExp, SocketedKind]> = [
  [/maldicion engarzad/, "curse"],
  // «los hechizos engarzados» y «los hechizos de fuego engarzados».
  [/hechizos (?:de \w+ )?engarzados/, "spell"],
  [/ataques a distancia engarzados/, "ranged-attack"],
  [/habilidades de maza engarzadas/, "mace-skill"],
];

/** null si la habilidad no es una metahabilidad. */
export function socketedKind(skill: GemSkill): SocketedKind | null {
  if (!skill.tags.includes("Metahabilidad")) return null;
  const text = normalizeGemText(skill.description);
  return SOCKETED_KINDS.find(([pattern]) => pattern.test(text))?.[1] ?? "skill";
}

/**
 * «Reserva 60 de espíritu por cada maldición engarzada», tal cual lo dice la
 * gema. Vale para el texto en español y para el traducido al inglés.
 */
export function socketedCost(skill: GemSkill): string | null {
  return skill.effects.find((effect) => /^reserv(?:a|es)\b.*(?:engarzad|socketed)/.test(normalizeGemText(effect))) ?? null;
}

export interface SocketableSkill {
  skill: GemSkill;
  /** La build del jugador nombra el tipo de daño de esta habilidad. */
  fits: boolean;
}

/**
 * Maldiciones que se pueden engarzar en Blasfemia. Primero las que encajan
 * con el tipo de daño de la build (caos → la que baja la resistencia al
 * caos); después, por grado. Solo ordena: todas valen.
 */
export function socketableCurses(data: GemData, build?: BuildContext | null): SocketableSkill[] {
  const theme = build ? buildTheme(build) : NO_THEME;
  return data.skills
    .filter((skill) => skill.tags.includes("Maldición") && !skill.tags.includes("Metahabilidad"))
    .map((skill) => ({ skill, fits: skill.tags.some((tag) => theme.elements.includes(tag)) }))
    .sort(
      (a, b) =>
        Number(b.fits) - Number(a.fits) ||
        // Entre las que encajan, la que baja una sola resistencia va antes que la genérica.
        a.skill.tags.filter((tag) => ELEMENT_TAGS.has(tag)).length - b.skill.tags.filter((tag) => ELEMENT_TAGS.has(tag)).length ||
        (a.skill.grade ?? 0) - (b.skill.grade ?? 0) ||
        a.skill.name.localeCompare(b.skill.name, "es"),
    );
}

export const SocketedSkillsSchema = z.object({
  kind: SocketedKindSchema,
  /** Lo que cuesta cada habilidad engarzada, con las palabras de la gema. */
  cost: z.string().nullable(),
  /** Las que se le pueden engarzar. Solo se listan cuando son pocas (maldiciones). */
  options: z.array(z.object({ name: z.string(), description: z.string(), fits: z.boolean() })),
});
export type SocketedSkills = z.infer<typeof SocketedSkillsSchema>;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const MAX_ADVICE_NOTE_LENGTH = 200;

/** Idioma de la respuesta. Las reglas deciden igual en los dos. */
export const AdviceLangSchema = z.enum(["es", "en"]);
export type AdviceLang = z.infer<typeof AdviceLangSchema>;

export const SupportAdviceRequestSchema = z.object({
  skill: z.string().trim().min(1).max(80),
  maxGrade: z.number().int().min(1).max(5),
  attributes: z.array(GemAttributeSchema).min(1).max(3),
  // Todas las asistencias que el personaje lleva, en cualquier habilidad: en
  // PoE2 cada una solo se puede poner una vez, así que ninguna vuelve a valer.
  socketed: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  /** Lo que el jugador cuenta («mis esqueletos mueren rápido»). Nunca es una instrucción. */
  note: z.string().trim().max(MAX_ADVICE_NOTE_LENGTH).optional(),
  build: BuildContextSchema.optional(),
  lang: AdviceLangSchema.optional(),
});
export type SupportAdviceRequest = z.infer<typeof SupportAdviceRequestSchema>;

export const SupportAdviceOptionSchema = z.object({
  name: z.string(),
  grade: z.number().int(),
  attribute: GemAttributeSchema,
  costMultiplier: z.string().nullable(),
  description: z.string(),
  effects: z.array(z.string()),
});
export type SupportAdviceOption = z.infer<typeof SupportAdviceOptionSchema>;

export const SupportAdviceResponseSchema = z.object({
  skill: z.object({ name: z.string(), tags: z.array(z.string()) }),
  /** Si es una metahabilidad: qué habilidades lleva engarzadas, además de asistencias. */
  sockets: SocketedSkillsSchema.nullable().default(null),
  /** null cuando ninguna asistencia cumple las condiciones. */
  recommended: SupportAdviceOptionSchema.extend({ reason: z.string() }).nullable(),
  alternatives: z.array(SupportAdviceOptionSchema),
  /** `ai`: la IA redactó el motivo. `rules`: motivo de las reglas. La elección es siempre de las reglas. */
  mode: z.enum(["ai", "rules"]),
  fallbackReason: z.string().nullable(),
  source: z.string(),
  fetchedAt: z.string(),
});
export type SupportAdviceResponse = z.infer<typeof SupportAdviceResponseSchema>;

export const GemSkillListResponseSchema = z.object({
  skills: z.array(z.object({ name: z.string(), tags: z.array(z.string()) })),
  fetchedAt: z.string(),
});
export type GemSkillListResponse = z.infer<typeof GemSkillListResponseSchema>;
