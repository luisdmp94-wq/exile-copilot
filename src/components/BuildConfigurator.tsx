import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Hammer, HelpCircle, Loader2, X } from "lucide-react";
import type { CharacterProfile } from "@shared/domain.js";
import { readCharacterLevel } from "@shared/domain.js";
import {
  GROUP_LABEL,
  SPELL_GROUPS,
  WEAPON_GROUPS,
  isSpellGroup,
  isWeaponGroup,
  skillWeaponFit,
  weaponInText,
  type SkillChoice,
  type SpellGroup,
  type WeaponGroup,
} from "@shared/skillChoice.js";
import { supportMainBenefit, type SupportAdviceResponse } from "@shared/supportGemAdvice.js";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { teaserGradeFor } from "@/lib/skillGemTeaser";
import { cn } from "@/lib/utils";
import { texts, useLang, useText } from "@/i18n/lang";

const STORAGE_KEY = "exile-copilot:monta-build";
const MAX_PICKED = 4;
const SHOWN_AT_FIRST = 6;
const ROMAN = ["", "I", "II", "III", "IV", "V"];

/** Lo que el jugador elige en el paso 1: una de las cinco armas o «hechizos». */
type Hand = WeaponGroup | "spells";

const TEXT = texts(
  {
    title: "Monta tu build",
    lead: "Tú eliges. Yo te digo qué vale con tu arma y por qué. No calculo daño.",
    step1: "1 · Tu arma",
    spells: "Hechizos",
    fromCharacter: (piece: string) => `Sacado de tu personaje: ${piece}.`,
    step2: (max: number) => `2 · Elige hasta ${max} habilidades`,
    weaponCount: (count: number, weapon: string) => `${count} de ${weapon}. Solo valen con esa arma en la mano.`,
    spellCount: (count: number, school: string) => `${count} de ${school}. Los hechizos no piden un arma concreta.`,
    school: "Escuela de hechizos",
    gemLevel: (grade: number) => `nivel de gema ${grade}`,
    needsShield: "pide escudo",
    showAll: (count: number) => `Ver las ${count}`,
    showLess: "Ver menos",
    useMine: "Añadir las que ya llevo",
    full: (max: number) => `Ya tienes ${max}. Quita una para añadir otra.`,
    yours: "Tu build",
    fitCount: (usable: number, total: number, weapon: string) => `Con ${weapon} puedes usar ${usable} de ${total}.`,
    fitUnknown: (count: number) => ` De ${count} no lo sé.`,
    spellHand: "un arma de hechicero",
    fitYes: (weapon: string) => `Vale con ${weapon}`,
    fitNo: (weapon: string) => `Pide ${weapon}`,
    fitSpell: "Hechizo: vale con cualquier arma",
    fitSpirit: "Gema de espíritu: no pide arma",
    fitUnknownOne: "No sé con qué arma sale",
    remove: (name: string) => `Quitar ${name}`,
    askSupports: "¿Qué asistencias le van?",
    loadingSupports: "Buscando…",
    noSupports: "No encuentro asistencias para esta.",
    first: "Empieza por",
    also: "También le van",
    tier: (grade: string) => `grado ${grade}`,
    inExchange: "A cambio:",
    gradeNote: "«Nivel de gema» es el de la gema de habilidad sin tallar que hace falta para tallarla.",
    footer: "Esto dice qué puedes usar y por qué, no cuánto daño hace. Datos del juego y reglas fijas, sin IA.",
    loading: "Cargando las habilidades…",
    failed: "No he podido cargar las habilidades. Prueba a recargar la página.",
    or: "o",
  },
  {
    title: "Build your own",
    lead: "You choose. I tell you what works with your weapon and why. I don't calculate damage.",
    step1: "1 · Your weapon",
    spells: "Spells",
    fromCharacter: (piece: string) => `Taken from your character: ${piece}.`,
    step2: (max: number) => `2 · Pick up to ${max} skills`,
    weaponCount: (count: number, weapon: string) => `${count} ${weapon} skills. They only work with that weapon in hand.`,
    spellCount: (count: number, school: string) => `${count} ${school} skills. Spells need no particular weapon.`,
    school: "Spell school",
    gemLevel: (grade: number) => `gem level ${grade}`,
    needsShield: "needs a shield",
    showAll: (count: number) => `Show all ${count}`,
    showLess: "Show fewer",
    useMine: "Add the ones I already use",
    full: (max: number) => `You already have ${max}. Remove one to add another.`,
    yours: "Your build",
    fitCount: (usable: number, total: number, weapon: string) => `With ${weapon} you can use ${usable} of ${total}.`,
    fitUnknown: (count: number) => ` ${count} I can't tell.`,
    spellHand: "a caster weapon",
    fitYes: (weapon: string) => `Works with a ${weapon}`,
    fitNo: (weapon: string) => `Needs a ${weapon}`,
    fitSpell: "Spell: works with any weapon",
    fitSpirit: "Spirit gem: needs no weapon",
    fitUnknownOne: "I don't know which weapon it needs",
    remove: (name: string) => `Remove ${name}`,
    askSupports: "Which supports fit it?",
    loadingSupports: "Looking…",
    noSupports: "I can't find supports for this one.",
    first: "Start with",
    also: "These fit too",
    tier: (grade: string) => `tier ${grade}`,
    inExchange: "In exchange:",
    gradeNote: "\"Gem level\" is the level of the uncut skill gem you need to engrave it.",
    footer: "This says what you can use and why, not how much damage it does. Game data and fixed rules, no AI.",
    loading: "Loading skills…",
    failed: "I couldn't load the skills. Try reloading the page.",
    or: "or",
  },
);

const capital = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** La habilidad de la lista con ese nombre, en español o en inglés. */
const findChoice = (choices: readonly SkillChoice[], name: string) =>
  choices.find((entry) => sameName(entry.name, name) || sameName(entry.alias, name));
/** ¿Es esa habilidad? Lo guardado puede venir en el otro idioma. */
const isSkill = (saved: string, skill: SkillChoice) => sameName(saved, skill.name) || sameName(saved, skill.alias);

const ENDS_IN_GRADE = /\s[IVX]+$/;
const GAIN = /\bmás de\b|\baumentad|\bmore\b|\bincreased\b/i;
const LOSS = /\bmenos de\b|\breducid|\bless\b|\breduced\b/i;
const lowerFirst = (text: string) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

/**
 * Lo que da la asistencia, en una línea. Si la primera línea de la gema es lo
 * que quita («un 15 % menos de velocidad») y otra dice lo que da, va primero
 * lo que da y después la pega: una pega sola parece un mal consejo.
 */
function benefitLine(option: { effects: readonly string[]; description: string }, inExchange: string): string {
  const main = supportMainBenefit(option);
  if (!LOSS.test(main) || GAIN.test(main)) return main;
  const gain = option.effects.find((effect) => GAIN.test(effect) && !LOSS.test(effect));
  return gain ? `${gain}. ${inExchange} ${lowerFirst(main)}` : main;
}

/**
 * El motivo trae una sola línea de la gema. Si esa línea es la condición
 * («consume un cadáver») y la gema tiene otra, falta lo que se gana: se añade.
 * Si el motivo no cita ninguna línea (lo cuenta con la descripción), se deja.
 */
function reasonWithExtra(recommended: { reason: string; effects: readonly string[] }): string {
  const used = recommended.effects.find((effect) => recommended.reason.includes(effect));
  // Solo si la línea citada no dice ya una ganancia, y solo una línea que sí la diga.
  if (used === undefined || GAIN.test(used)) return recommended.reason;
  const extra = recommended.effects.find((effect) => effect !== used && GAIN.test(effect));
  return extra === undefined ? recommended.reason : `${recommended.reason.replace(/\.\s*$/, "")}. ${extra}`;
}

interface Saved {
  hand: Hand | null;
  school: SpellGroup | null;
  picked: string[];
}

function readSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    const hand = parsed.hand === "spells" || (typeof parsed.hand === "string" && isWeaponGroup(parsed.hand)) ? parsed.hand : null;
    const school = typeof parsed.school === "string" && isSpellGroup(parsed.school) ? parsed.school : null;
    const picked = Array.isArray(parsed.picked) ? parsed.picked.filter((name): name is string => typeof name === "string").slice(0, MAX_PICKED) : [];
    return { hand, school, picked };
  } catch {
    return null;
  }
}

/** El arma del personaje: por el nombre de la pieza o, si no dice nada, por sus habilidades. */
function handOf(
  profile: CharacterProfile | null,
  choices: readonly SkillChoice[],
): { hand: Hand | null; piece: string | null; school: SpellGroup | null } {
  if (!profile) return { hand: null, piece: null, school: null };
  const item = profile.items.find((entry) => entry.slot === "weapon");
  const piece = item ? item.baseType || item.name || null : null;
  const read = item ? weaponInText(`${item.name} ${item.baseType}`) : null;
  const count = new Map<Hand, number>();
  // La escuela de la que más hechizos lleva: a una bruja de caos, ocultismo.
  const schools = new Map<SpellGroup, number>();
  for (const setup of profile.skills) {
    const choice = findChoice(choices, setup.mainSkill || setup.label || "");
    if (!choice) continue;
    for (const group of choice.groups) {
      if (isWeaponGroup(group)) count.set(group, (count.get(group) ?? 0) + 1);
      else if (isSpellGroup(group)) {
        count.set("spells", (count.get("spells") ?? 0) + 1);
        schools.set(group, (schools.get(group) ?? 0) + 1);
      }
    }
  }
  const school = [...schools.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (read) return { hand: read.group ?? "spells", piece, school };
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { hand: best, piece: null, school };
}

interface BuildConfiguratorProps {
  profile: CharacterProfile | null;
}

/**
 * «Monta tu build» (tarea 16, 27-11-2026). Sale de lo que pidió Gabo, el
 * hermano de Luis: elegir él las habilidades en vez de copiar una build, y
 * algo que le diga si le valen con su arma. Aquí no hay porcentaje de
 * efectividad: la web no calcula daño. Hay un recuento honesto («puedes usar
 * 3 de 4») y el porqué de cada una.
 */
export function BuildConfigurator({ profile }: BuildConfiguratorProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const [loaded, setLoaded] = useState<{ lang: string; skills: SkillChoice[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [saved] = useState(readSaved);
  const [chosenHand, setChosenHand] = useState<Hand | null>(saved?.hand ?? null);
  const [chosenSchool, setChosenSchool] = useState<SpellGroup | null>(saved?.school ?? null);
  const [picked, setPicked] = useState<string[]>(saved?.picked ?? []);
  const [showAll, setShowAll] = useState(false);
  const [supports, setSupports] = useState<Record<string, SupportAdviceResponse | "loading" | "none">>({});

  useEffect(() => {
    let cancelled = false;
    api
      .skillChoices(lang)
      .then((response) => {
        if (!cancelled) setLoaded({ lang, skills: response.skills });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const choices = useMemo(() => (loaded?.lang === lang ? loaded.skills : []), [loaded, lang]);
  const fromProfile = useMemo(() => handOf(profile, choices), [profile, choices]);
  // Lo que el jugador pulsa manda; si no ha pulsado nada, su personaje.
  const hand: Hand | null = chosenHand ?? fromProfile.hand;
  const school: SpellGroup = chosenSchool ?? fromProfile.school ?? "Elemental";

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ hand: chosenHand, school: chosenSchool, picked } satisfies Saved));
    } catch {
      // Sin almacenamiento (modo privado): el configurador funciona igual, solo no recuerda.
    }
  }, [chosenHand, chosenSchool, picked]);

  const label = (group: string) => GROUP_LABEL[lang][group] ?? group.toLowerCase();
  const group = hand === "spells" ? school : hand;
  const inGroup = useMemo(
    () =>
      group === null
        ? []
        : choices
            .filter((skill) => skill.groups.includes(group))
            .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, lang)),
    [choices, group, lang],
  );
  const visible = showAll ? inGroup : inGroup.slice(0, SHOWN_AT_FIRST);

  /** La misma habilidad, se guardara en español o en inglés. */
  const same = (saved: string, name: string) => {
    const choice = findChoice(choices, name);
    return choice ? isSkill(saved, choice) : sameName(saved, name);
  };
  /** El nombre en el idioma de la web; si la web no la conoce, como se escribió. */
  const shown = (name: string) => findChoice(choices, name)?.name ?? name;

  const toggle = (name: string) => {
    setPicked((current) =>
      current.some((entry) => same(entry, name))
        ? current.filter((entry) => !same(entry, name))
        : current.length >= MAX_PICKED
          ? current
          : [...current, name],
    );
  };

  const ownNames = (profile?.skills ?? [])
    .map((setup) => (setup.mainSkill || setup.label || "").trim())
    .filter((name) => name !== "");
  const addMine = () => {
    setPicked((current) => {
      const next = [...current];
      for (const name of ownNames) {
        if (next.length >= MAX_PICKED) break;
        // Con el nombre de la lista si la web la conoce; si no, como la escribió.
        const known = shown(name);
        if (!next.some((entry) => same(entry, known))) next.push(known);
      }
      return next;
    });
  };

  const askSupports = (name: string) => {
    setSupports((current) => ({ ...current, [name]: "loading" }));
    const reading = profile ? readCharacterLevel(profile) : null;
    // Una asistencia solo va en una habilidad: la que ya se propuso como
    // primera para otra de la build no se vuelve a proponer aquí.
    const taken = picked.flatMap((other) => {
      const answer = other === name ? undefined : supports[other];
      return typeof answer === "object" && answer.recommended ? [answer.recommended.name] : [];
    });
    api
      .supportGemPreview({
        skill: name.slice(0, 80),
        maxGrade: teaserGradeFor(reading?.known ? reading.level : null),
        attributes: ["Int", "Des", "Fue"],
        ...(taken.length > 0 ? { socketed: taken } : {}),
        lang,
      })
      .then((response) => setSupports((current) => ({ ...current, [name]: response.recommended ? response : "none" })))
      .catch(() => setSupports((current) => ({ ...current, [name]: "none" })));
  };

  /** ¿Vale la habilidad con lo que lleva en la mano? null: no se sabe. */
  const fitOf = (name: string): { usable: boolean | null; text: string } => {
    const groups = findChoice(choices, name)?.groups ?? [];
    const fit = skillWeaponFit(groups, hand !== null && hand !== "spells" ? hand : null);
    if (fit.kind === "weapon") {
      const needs = fit.weapons.map(label).join(` ${t.or} `);
      // Con un arma de hechicero en la mano, una habilidad de arma no vale.
      const usable = hand === "spells" ? false : fit.fits;
      return { usable, text: usable === true ? t.fitYes(needs) : t.fitNo(needs) };
    }
    if (fit.kind === "spell") return { usable: true, text: t.fitSpell };
    if (fit.kind === "spirit") return { usable: true, text: t.fitSpirit };
    return { usable: null, text: t.fitUnknownOne };
  };

  const fits = picked.map((name) => ({ name, ...fitOf(name) }));
  const usableCount = fits.filter((entry) => entry.usable === true).length;
  const unknownCount = fits.filter((entry) => entry.usable === null).length;
  const handWords = hand === null ? null : hand === "spells" ? t.spellHand : label(hand);

  return (
    <section
      id="monta-build"
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="monta-build-titulo"
      data-testid="monta-build"
    >
      <h2 id="monta-build-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Hammer className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.lead}</p>

      {failed ? (
        <p className="mt-3 text-sm text-muted-foreground" role="alert">
          {t.failed}
        </p>
      ) : choices.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t.loading}
        </p>
      ) : (
        <>
          <h3 className="mt-4 text-sm font-semibold text-foreground">{t.step1}</h3>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t.step1} data-testid="monta-build-armas">
            {[...WEAPON_GROUPS, "spells" as const].map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={hand === option ? "default" : "outline"}
                aria-pressed={hand === option}
                onClick={() => {
                  setChosenHand(option);
                  setShowAll(false);
                }}
              >
                {option === "spells" ? t.spells : capital(label(option))}
              </Button>
            ))}
          </div>
          {chosenHand === null && fromProfile.hand !== null && fromProfile.piece !== null && (
            <p className="mt-1.5 text-xs text-muted-foreground">{t.fromCharacter(fromProfile.piece)}</p>
          )}

          {hand === "spells" && (
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t.school}>
              {SPELL_GROUPS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={school === option ? "secondary" : "ghost"}
                  aria-pressed={school === option}
                  onClick={() => {
                    setChosenSchool(option);
                    setShowAll(false);
                  }}
                >
                  {capital(label(option))}
                </Button>
              ))}
            </div>
          )}

          {group !== null && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{t.step2(MAX_PICKED)}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {hand === "spells" ? t.spellCount(inGroup.length, label(group)) : t.weaponCount(inGroup.length, label(group))}
              </p>
              {/* Arriba de la lista: explica por qué el resto sale apagado. */}
              {picked.length >= MAX_PICKED && <p className="mt-1.5 text-xs font-medium text-foreground/90">{t.full(MAX_PICKED)}</p>}
              <ul className="mt-2 space-y-1.5" data-testid="monta-build-lista">
                {visible.map((skill) => {
                  const isPicked = picked.some((entry) => isSkill(entry, skill));
                  const blocked = !isPicked && picked.length >= MAX_PICKED;
                  return (
                    <li key={skill.name}>
                      <button
                        type="button"
                        aria-pressed={isPicked}
                        disabled={blocked}
                        onClick={() => toggle(skill.name)}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                          isPicked ? "border-primary/50 bg-primary/[0.08]" : "border-border hover:bg-accent/40",
                          blocked && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-semibold text-foreground">
                            {isPicked && <Check className="mr-1 inline size-3.5 text-primary" aria-hidden="true" />}
                            {skill.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t.gemLevel(skill.grade)}
                            {skill.needsShield ? ` · ${t.needsShield}` : ""}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{skill.summary}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {inGroup.length > SHOWN_AT_FIRST && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((current) => !current)} data-testid="monta-build-todas">
                    <ChevronDown className={cn("size-4 transition-transform", showAll && "rotate-180")} aria-hidden="true" />
                    {showAll ? t.showLess : t.showAll(inGroup.length)}
                  </Button>
                )}
                {ownNames.length > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={addMine} disabled={picked.length >= MAX_PICKED} data-testid="monta-build-mias">
                    {t.useMine}
                  </Button>
                )}
              </div>
            </>
          )}

          {picked.length > 0 && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-3" data-testid="monta-build-tuya">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t.yours}</p>
              {handWords !== null && (
                <p className="mt-0.5 text-base font-semibold text-foreground" data-testid="monta-build-recuento">
                  {t.fitCount(usableCount, picked.length, handWords)}
                  {unknownCount > 0 && <span className="font-normal text-muted-foreground">{t.fitUnknown(unknownCount)}</span>}
                </p>
              )}
              <ul className="mt-2 space-y-2.5">
                {fits.map((entry) => {
                  const answer = supports[entry.name];
                  return (
                    <li key={entry.name} className="border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-foreground">{shown(entry.name)}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                            entry.usable === true && "bg-emerald-500/15 text-emerald-200",
                            entry.usable === false && "bg-rose-500/15 text-rose-200",
                            entry.usable === null && "bg-muted text-muted-foreground",
                          )}
                        >
                          {entry.usable === true ? (
                            <Check className="size-3" aria-hidden="true" />
                          ) : entry.usable === false ? (
                            <X className="size-3" aria-hidden="true" />
                          ) : (
                            <HelpCircle className="size-3" aria-hidden="true" />
                          )}
                          {entry.text}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="ml-auto"
                          aria-label={t.remove(shown(entry.name))}
                          onClick={() => toggle(entry.name)}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                      {answer === undefined ? (
                        <Button type="button" variant="outline" size="sm" className="mt-1.5" onClick={() => askSupports(entry.name)}>
                          {t.askSupports}
                        </Button>
                      ) : answer === "loading" ? (
                        <p className="mt-1.5 text-xs text-muted-foreground" role="status">
                          {t.loadingSupports}
                        </p>
                      ) : answer === "none" || answer.recommended === null ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">{t.noSupports}</p>
                      ) : (
                        <div className="mt-1.5 text-sm leading-relaxed">
                          <p className="text-foreground/90">
                            <span className="text-xs font-semibold uppercase tracking-wide text-primary">{t.first}</span>{" "}
                            <span className="font-semibold text-foreground">{answer.recommended.name}</span>
                            {/* «Furia I · grado I» dice lo mismo dos veces. */}
                            {!ENDS_IN_GRADE.test(answer.recommended.name) && (
                              <span className="text-xs text-muted-foreground">
                                {" "}
                                · {t.tier(ROMAN[answer.recommended.grade] ?? String(answer.recommended.grade))}
                              </span>
                            )}
                          </p>
                          <p className="text-muted-foreground">{reasonWithExtra(answer.recommended)}</p>
                          {answer.alternatives.length > 0 && (
                            <>
                              <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.also}</p>
                              <ul className="mt-0.5 space-y-1">
                                {answer.alternatives.slice(0, 2).map((option) => (
                                  <li key={option.name} className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">{option.name}</span> — {benefitLine(option, t.inExchange)}
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {group !== null && `${t.gradeNote} `}
            {t.footer}
          </p>
        </>
      )}
    </section>
  );
}
