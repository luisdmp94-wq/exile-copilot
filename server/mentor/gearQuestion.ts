/**
 * El Mentor de equipo (28-11-2026, tarea 18 del plan).
 *
 * Idea de Luis, de la versión de septiembre de la web (rama
 * `crafting-real-item-coach`, `server/mentor/equipment*.ts`): comparar la pieza
 * que llevas con otra y preguntarle al Mentor por ese cambio. Allí la IA
 * elegía la pieza y escribía los motivos; hicieron falta veintisiete archivos
 * de filtros y aun así confundía habilidades, cambiaba cifras y se quedaba sin
 * cupo (7.500 tokens por consulta).
 *
 * Aquí se hace como el resto del Mentor de hoy: **las reglas comparan y
 * deciden** (`shared/itemCompare.ts`, lo mismo que enseña «¿Me sirve lo que he
 * encontrado?») y de esa comparación salen frases sueltas, cada una con su
 * tema. La IA solo elige cuáles contestan a la pregunta y escribe la entrada.
 * Sin IA, contesta este archivo con las mismas frases.
 */
import type { CharacterProfile, Item } from "../../shared/domain.js";
import { checkRequirements, foundVerdict, type FoundVerdict } from "../../shared/foundItem.js";
import { attributeRiskText, attributeSwapRisks } from "../../shared/gearSwap.js";
import { compareItems, contextFromProfile, type CompareResult, type CompareRow, type CompareStyle } from "../../shared/itemCompare.js";
import type { MentorGearAsk } from "../../shared/mentorQuery.js";
import { normalizeQuestion } from "../../shared/mentorIntent.js";
import { findSkillAnyLang, localizeSkill } from "../advice/gemLocale.js";
import type { GemKnowledge } from "./gemQuestion.js";
import { skillFitLines } from "./gearSkillFit.js";
import type { TopicLine } from "./mentorWriter.js";

type Lang = "es" | "en";

/** Las frases de una misma clase: «¿y qué más pierdo?» quita las ya dichas de su grupo. */
export const GEAR_GROUP = "equipo:";

const WORDS = {
  es: {
    topic: "comparación de equipo",
    verdict: "el veredicto: si le conviene la pieza encontrada",
    why: "por qué (el motivo del veredicto)",
    gain: "lo que GANA si se pone la encontrada",
    lose: "lo que PIERDE si se pone la encontrada",
    even: "en lo que las dos piezas dan casi lo mismo",
    requirements: "si se la puede poner: nivel y atributos que pide la encontrada",
    risk: "cuidado al cambiarla: otra pieza se quedaría sin su requisito",
    wasted: "líneas de la encontrada que no aprovecha con su forma de jugar",
    method: "cómo se ha comparado y qué no se mira",
    skill: (skill: string) => `qué líneas de daño le llegan a su habilidad principal, ${skill}, y cuáles no`,
    leadSkill: (skill: string) => `Para ${skill}, esto es lo que cuenta de las dos piezas:`,
    noSkillLines: (skill: string) =>
      `Ninguna línea de estas dos piezas depende de ${skill}: lo que dan (vida, resistencias, defensa) te sirve juegues con lo que juegues.`,
    noSkillKnown: "No sé cuál es tu habilidad principal: apúntala en tu personaje y te digo qué líneas le llegan.",
    styles: { caster: "hechizos y esbirros", melee: "cuerpo a cuerpo", ranged: "arco o ballesta" } as Record<CompareStyle, string>,
    better: (found: string, worn: string) => `Sí: «${found}» te conviene más que «${worn}», la que llevas en ese hueco.`,
    worse: (found: string, worn: string) => `No: «${worn}», la que llevas, te conviene más que «${found}».`,
    tie: (found: string, worn: string) => `Da casi igual: «${found}» y «${worn}» están muy parejas para cómo juegas.`,
    blocked: (found: string) => `Todavía no te puedes poner «${found}».`,
    blockedThen: {
      better: (worn: string) => `Cuando puedas ponértela, te conviene más que «${worn}».`,
      worse: (worn: string) => `Y aunque pudieras, «${worn}» te conviene más.`,
      tie: (worn: string) => `Cuando puedas ponértela, quedará muy pareja con «${worn}».`,
    },
    empty: (found: string) => `No llevas nada en ese hueco: «${found}» suma, póntela.`,
    emptyOffhand: (found: string) =>
      `No llevas nada en la mano secundaria: «${found}» te suma si tu arma es de una mano.`,
    rowGain: (label: string, worn: string, found: string) =>
      worn === "nada" ? `${label}: la encontrada da ${found} y la que llevas, nada.` : `${label}: la que llevas da ${worn} y la encontrada ${found}.`,
    rowLose: (label: string, worn: string, found: string) =>
      found === "nada" ? `${label}: la que llevas da ${worn} y la encontrada, nada.` : `${label}: la que llevas da ${worn} y la encontrada solo ${found}.`,
    rowEven: (label: string, worn: string, found: string) => `${label}: ${worn} la que llevas y ${found} la encontrada.`,
    none: "nada",
    quote: (line: string) => `«${line}»`,
    andMore: (count: number) => ` y ${count} más`,
    leadLose: (found: string) => `Si te pones «${found}», esto es lo que pierdes:`,
    leadGain: (found: string) => `Con «${found}» ganas esto:`,
    leadWear: (found: string) => `Para ponerte «${found}», esto es lo que hay:`,
    noRequirements: "En lo que has pegado no pone que pida nivel ni atributos.",
    meets: "Cumples el nivel y los atributos que pide la encontrada.",
    noRisk: "Al cambiarla no pierdes atributo que le haga falta a otra pieza de las que llevas.",
    wastedLine: (line: string, style: string) => `«${line}» no la aprovechas jugando con ${style}.`,
    methodLine: (style: string, minions: boolean) =>
      `Las he comparado para un personaje de ${style}${minions ? " que lleva esbirros" : ""}. Miro lo que pone en las dos piezas: no calculo tu daño total ni miro tu árbol.`,
    nothingLost: "De lo que comparo, no pierdes nada: la encontrada da igual o más en todo.",
    nothingGained: "De lo que comparo, no ganas nada: la que llevas da igual o más en todo.",
  },
  en: {
    topic: "gear comparison",
    verdict: "the verdict: whether the found item is worth wearing",
    why: "why (the reason for the verdict)",
    gain: "what they GAIN by wearing the found item",
    lose: "what they LOSE by wearing the found item",
    even: "where both items give about the same",
    requirements: "whether they can wear it: level and attributes the found item needs",
    risk: "careful when swapping: another item would lose its requirement",
    wasted: "lines on the found item their playstyle doesn't use",
    method: "how it was compared and what isn't checked",
    skill: (skill: string) => `which damage lines reach their main skill, ${skill}, and which don't`,
    leadSkill: (skill: string) => `For ${skill}, this is what counts on the two items:`,
    noSkillLines: (skill: string) =>
      `No line on these two items depends on ${skill}: what they give (life, resistances, defences) helps whatever you play.`,
    noSkillKnown: "I don't know your main skill: add it to your character and I'll tell you which lines reach it.",
    styles: { caster: "spells and minions", melee: "melee", ranged: "bow or crossbow" } as Record<CompareStyle, string>,
    better: (found: string, worn: string) => `Yes: “${found}” suits you better than “${worn}”, the one you wear in that slot.`,
    worse: (found: string, worn: string) => `No: “${worn}”, the one you wear, suits you better than “${found}”.`,
    tie: (found: string, worn: string) => `It barely matters: “${found}” and “${worn}” are very close for how you play.`,
    blocked: (found: string) => `You can't wear “${found}” yet.`,
    blockedThen: {
      better: (worn: string) => `Once you can wear it, it suits you better than “${worn}”.`,
      worse: (worn: string) => `And even if you could, “${worn}” suits you better.`,
      tie: (worn: string) => `Once you can wear it, it will be very close to “${worn}”.`,
    },
    empty: (found: string) => `You wear nothing in that slot: “${found}” is a gain, put it on.`,
    emptyOffhand: (found: string) => `Your off hand is empty: “${found}” is a gain if your weapon is one-handed.`,
    rowGain: (label: string, worn: string, found: string) =>
      worn === "none" ? `${label}: the found one gives ${found} and the one you wear, none.` : `${label}: the one you wear gives ${worn} and the found one ${found}.`,
    rowLose: (label: string, worn: string, found: string) =>
      found === "none" ? `${label}: the one you wear gives ${worn} and the found one, none.` : `${label}: the one you wear gives ${worn} and the found one only ${found}.`,
    rowEven: (label: string, worn: string, found: string) => `${label}: ${worn} on the one you wear and ${found} on the found one.`,
    none: "none",
    quote: (line: string) => `“${line}”`,
    andMore: (count: number) => ` and ${count} more`,
    leadLose: (found: string) => `If you wear “${found}”, this is what you lose:`,
    leadGain: (found: string) => `With “${found}” you gain this:`,
    leadWear: (found: string) => `To wear “${found}”, this is what there is:`,
    noRequirements: "What you pasted doesn't say it needs any level or attributes.",
    meets: "You meet the level and attributes the found item needs.",
    noRisk: "Swapping it doesn't cost you an attribute another item you wear needs.",
    wastedLine: (line: string, style: string) => `You don't use “${line}” playing with ${style}.`,
    methodLine: (style: string, minions: boolean) =>
      `I compared them for a ${style} character${minions ? " that uses minions" : ""}. I look at what both items say: I don't work out your total damage or read your tree.`,
    nothingLost: "From what I compare, you lose nothing: the found one gives the same or more everywhere.",
    nothingGained: "From what I compare, you gain nothing: the one you wear gives the same or more everywhere.",
  },
} as const;

/** El texto avanzado escribe la tirada con su rango: `+28(25-30)%`. Aquí sobra. */
const ROLL_RANGE = /\((-?\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)\)/g;

export interface GearReading {
  verdict: FoundVerdict;
  found: Item;
  /** La pieza que lleva en ese hueco; null si el hueco está vacío. */
  worn: Item | null;
  result: CompareResult | null;
  /** La habilidad principal del personaje, si los datos de gemas la conocen. */
  skillName: string | null;
  /** Todo lo que se sabe de la comparación, frase a frase, con su tema. */
  lines: TopicLine[];
}

/** Cuántas líneas de «le llega / no le llega» se enseñan como mucho. */
const SKILL_LINES = 5;

const isRing = (slot: Item["slot"]) => slot === "ring1" || slot === "ring2";

/**
 * La pieza con la que se compara. El navegador dice cuál es (con dos anillos
 * lo elige el jugador), pero solo vale si de verdad la lleva puesta y va en el
 * mismo hueco: lo que llega del navegador no se da por bueno.
 */
function wornItem(profile: Pick<CharacterProfile, "items">, gear: MentorGearAsk): Item | null {
  if (gear.wornId === null) return null;
  const worn = profile.items.find((item) => item.id === gear.wornId) ?? null;
  if (!worn || worn.id === gear.found.id) return null;
  const sameSlot = worn.slot === gear.found.slot || (isRing(worn.slot) && isRing(gear.found.slot));
  return sameSlot ? worn : null;
}

/** La comparación entera, con las mismas reglas que la tarjeta de la web. */
export function gearReading(
  profile: CharacterProfile,
  gear: MentorGearAsk,
  lang: Lang = "es",
  /** Datos de gemas: con ellos se sabe a qué habilidad le llega cada línea de daño. */
  gems: GemKnowledge | null = null,
): GearReading {
  const words = WORDS[lang];
  const found = gear.found;
  const worn = wornItem(profile, gear);
  const requirements = checkRequirements(found, profile, lang);
  const minions = gear.style === "caster" && gear.minions;
  const result = worn
    ? compareItems(worn, found, gear.style, lang, { ...contextFromProfile(profile, found.slot), equipped: worn, minions })
    : null;
  const verdict = foundVerdict(requirements, result);
  const tema = (what: string) => `${words.topic} · ${what}`;
  const lines: TopicLine[] = [];
  const wornName = worn?.name ?? "";

  // 1. El veredicto, en una frase.
  const after: "better" | "worse" | "tie" | null = result ? (result.winner === "b" ? "better" : result.winner === "a" ? "worse" : "tie") : null;
  const verdictText =
    verdict === "blocked"
      ? [words.blocked(found.name), ...requirements.blocked, ...(after ? [words.blockedThen[after](wornName)] : [])].join(" ")
      : verdict === "empty"
        ? found.slot === "offhand"
          ? words.emptyOffhand(found.name)
          : words.empty(found.name)
        : words[verdict](found.name, wornName);
  lines.push({ tema: tema(words.verdict), texto: verdictText });

  if (result) {
    // 2. El motivo, como lo dice el comparador.
    for (const reason of result.reasons) lines.push({ tema: tema(words.why), texto: reason });

    // 3. Fila a fila: A es la que lleva, B la encontrada. Lo que más pesa, primero.
    const byWeight = [...result.rows].sort((x, y) => y.weight * y.margin - x.weight * x.margin);
    // La fila de daño cuenta líneas («1 línea»): al jugador se le dice cuáles son.
    const quoted = (side: "a" | "b") => {
      const shown = result.damageLines[side].slice(0, 2).map((line) => words.quote(line.replace(ROLL_RANGE, "").replace(/\s+/g, " ").trim()));
      const more = result.damageLines[side].length - shown.length;
      return shown.length === 0 ? words.none : `${shown.join(", ")}${more > 0 ? words.andMore(more) : ""}`;
    };
    const rowLine = (shownRow: CompareRow): TopicLine => {
      const row = shownRow.id === "damage" ? { ...shownRow, a: quoted("a"), b: quoted("b") } : shownRow;
      return row.winner === "b"
        ? { tema: tema(words.gain), texto: words.rowGain(row.label, row.a, row.b), grupo: `${GEAR_GROUP}gana` }
        : row.winner === "a"
          ? { tema: tema(words.lose), texto: words.rowLose(row.label, row.a, row.b), grupo: `${GEAR_GROUP}pierde` }
          : { tema: tema(words.even), texto: words.rowEven(row.label, row.a, row.b), grupo: `${GEAR_GROUP}parejas` };
    };
    const rows = byWeight.map(rowLine);
    lines.push(...rows.filter((line) => line.grupo === `${GEAR_GROUP}gana`));
    lines.push(...rows.filter((line) => line.grupo === `${GEAR_GROUP}pierde`));
    lines.push(...rows.filter((line) => line.grupo === `${GEAR_GROUP}parejas`));
  }

  // 4. ¿Se la puede poner?
  for (const texto of [...requirements.blocked, ...requirements.unchecked]) {
    lines.push({ tema: tema(words.requirements), texto });
  }
  const asksSomething = Object.values(found.requirements ?? {}).some((value) => typeof value === "number" && value > 0);
  if (asksSomething && requirements.blocked.length === 0 && requirements.unchecked.length === 0) {
    lines.push({ tema: tema(words.requirements), texto: words.meets });
  }
  // Sin requisitos en el texto pegado no se afirma que pueda: se dice que no lo pone.
  if (!asksSomething) lines.push({ tema: tema(words.requirements), texto: words.noRequirements });

  // 5. Lo que se le cae a otra pieza al cambiar.
  if (worn) {
    const risks = attributeSwapRisks(worn, found, profile.items, profile.attributes);
    for (const risk of risks) lines.push({ tema: tema(words.risk), texto: attributeRiskText(risk, worn.name, lang) });
  }

  // 5b. Su habilidad principal: qué líneas de daño le llegan y cuáles no. Lo que
  // no le llega de la encontrada va primero: es lo que el jugador no ve solo.
  const mainSetup = profile.skills.find((setup) => (setup.mainSkill || setup.label).trim() !== "");
  const mainSkill = gems && mainSetup ? findSkillAnyLang(gems.data, gems.locale, mainSetup.mainSkill || mainSetup.label) : null;
  const skillName = gems && mainSkill ? localizeSkill(mainSkill, lang, gems.locale).name : null;
  if (mainSkill && skillName) {
    const fit = skillFitLines(skillName, mainSkill.tags, found, worn, lang);
    const ordered = [
      ...fit.filter((line) => line.side === "found" && !line.reaches),
      ...fit.filter((line) => line.side === "found" && line.reaches),
      ...fit.filter((line) => line.side === "worn"),
    ];
    for (const line of ordered.slice(0, SKILL_LINES)) {
      lines.push({ tema: tema(words.skill(skillName)), texto: line.texto, grupo: `${GEAR_GROUP}habilidad` });
    }
  }

  // 6. Lo que la encontrada trae y no le sirve, y cómo se ha comparado.
  if (result) {
    for (const line of result.wasted.b.slice(0, 3)) {
      const clean = line.replace(ROLL_RANGE, "").replace(/\s+/g, " ").trim();
      lines.push({ tema: tema(words.wasted), texto: words.wastedLine(clean, words.styles[gear.style]) });
    }
    lines.push({ tema: tema(words.method), texto: words.methodLine(words.styles[gear.style], minions) });
  }

  return { verdict, found, worn, result, skillName, lines };
}

type Ask = "why" | "lose" | "gain" | "wear" | "skill" | "general";

/** «¿Le sirve a mi habilidad?», «¿y para mi build?», «¿para cómo juego?». */
const SKILL_ASK = /\bhabilidad|\bskill|\bbuild\b|\bcomo juego\b|\bhow i play\b|\bmi gema\b|\bmy gem\b/;

const WEAR_ASK = /\b(?:puedo|podre|podria)\s+(?:ponerm|llevar|equipar|usar)|\bme l[ao] puedo\b|\brequisit|\bme llega\b|\bcan i (?:wear|equip|use)\b|\brequire/;
const LOSE_ASK = /\bpierd|\bperder|\bsacrific|\bme quita|\bempeor|\b(?:lose|losing|give up|worse at)\b/;
const GAIN_ASK = /\bgano\b|\bganar\b|\bgana\b|\bme da\b|\bmejora\b|\b(?:gain|get|better at)\b/;
const WHY_ASK = /\bpor que\b|\bporque\b|\bmotivo|\brazon|\bwhy\b|\bhow come\b|\breason/;

/** De qué pregunta, por palabras. Solo se usa cuando la IA no redacta. */
function askOf(question: string): Ask {
  const normalized = normalizeQuestion(question);
  if (SKILL_ASK.test(normalized)) return "skill";
  if (WEAR_ASK.test(normalized)) return "wear";
  if (LOSE_ASK.test(normalized)) return "lose";
  if (GAIN_ASK.test(normalized)) return "gain";
  if (WHY_ASK.test(normalized)) return "why";
  return "general";
}

/** Cuántas frases enseña la respuesta de las reglas, además de la entrada. */
const RULES_LINES = 4;

/**
 * La respuesta sin IA: una entrada que contesta a lo que pregunta y las frases
 * que tocan. El veredicto ya lo tiene encima, en la tarjeta: solo se repite si
 * es de lo que pregunta o no hay otra cosa que decir. Mismo formato que las
 * respuestas redactadas: una entrada y puntos.
 */
export function gearRulesAnswer(reading: GearReading, question: string, lang: Lang = "es"): string {
  const words = WORDS[lang];
  const of = (what: string) => reading.lines.filter((line) => line.tema === `${words.topic} · ${what}`).map((line) => line.texto);
  const verdict = of(words.verdict)[0] ?? "";
  const asked = askOf(question);
  // Sin pieza con la que comparar no hay «qué pierdo» ni «por qué»: queda el veredicto.
  const ask = reading.result || asked === "wear" || asked === "skill" ? asked : "general";
  const blocked = reading.verdict === "blocked";
  const name = reading.found.name;
  let lead = verdict;
  let picked: string[] = [];
  if (ask === "skill") {
    const skill = reading.skillName;
    picked = skill ? of(words.skill(skill)) : [];
    lead = !skill ? words.noSkillKnown : picked.length > 0 ? words.leadSkill(skill) : words.noSkillLines(skill);
  } else if (ask === "lose") {
    picked = [...of(words.risk), ...of(words.lose)];
    lead = picked.length > 0 ? words.leadLose(name) : words.nothingLost;
  } else if (ask === "gain") {
    picked = of(words.gain);
    lead = picked.length > 0 ? words.leadGain(name) : words.nothingGained;
  } else if (ask === "wear") {
    // Sin poder ponérsela, el veredicto ya dice por qué, con sus números.
    picked = blocked ? of(words.risk) : [...of(words.requirements), ...of(words.risk)];
    if (!blocked) {
      lead = words.leadWear(name);
      if (reading.worn && of(words.risk).length === 0) picked.push(words.noRisk);
    }
  } else if (ask === "why") {
    const reasons = of(words.why);
    lead = blocked ? verdict : (reasons[0] ?? verdict);
    // El segundo motivo («Pierdes X…») ya lo dice, con números, la fila de lo que pierde.
    const loses = of(words.lose).slice(0, 2);
    picked = [...of(words.gain).slice(0, 2), ...(loses.length > 0 ? loses : reasons.slice(1, 2))];
  } else {
    picked = [...of(words.why).slice(0, 2), ...of(words.risk), ...of(words.wasted).slice(0, 1)];
  }
  const body = [...new Set(picked)]
    .filter((line) => line !== lead)
    .slice(0, RULES_LINES)
    .map((line) => `• ${line}`);
  return [lead, body.join("\n")].filter((part) => part.length > 0).join("\n\n");
}
