import { useEffect, useState } from "react";
import { ArrowRight, Gem } from "lucide-react";
import type { CharacterProfile } from "@shared/domain.js";
import { readCharacterLevel } from "@shared/domain.js";
import { supportMainBenefit, type SupportAdviceResponse } from "@shared/supportGemAdvice.js";
import { api } from "@/lib/api";
import { mainSkillOf, teaserGradeFor } from "@/lib/skillGemTeaser";
import { Button } from "@/components/ui/button";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    title: (skill: string) => `Gemas de asistencia para ${skill}`,
    lead: "Con la habilidad que me has dicho. Reglas y datos del juego, sin IA.",
    loading: "Buscando qué le va bien…",
    first: "Empieza por",
    also: "También le van",
    tier: (grade: string) => `grado ${grade}`,
    upTo: (grade: string) =>
      `Te enseño hasta grado ${grade}. Si tu gema sin tallar es de más grado, en el consejero completo salen más.`,
    open: "Abrir el consejero completo",
  },
  {
    title: (skill: string) => `Support gems for ${skill}`,
    lead: "From the skill you told me. Rules and game data, no AI.",
    loading: "Looking for what fits it…",
    first: "Start with",
    also: "These fit too",
    tier: (grade: string) => `tier ${grade}`,
    upTo: (grade: string) =>
      `Showing up to tier ${grade}. If your uncut gem is a higher tier, the full advisor shows more.`,
    open: "Open the full advisor",
  },
);

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const UNKNOWN_CLASS = /^(?:desconocid[ao]|unknown)$/i;

interface SkillGemTeaserProps {
  profile: CharacterProfile;
  /** Lleva al consejero completo de gemas. */
  onOpenAdvisor: () => void;
}

/**
 * «Gemas de asistencia para tu habilidad»: lo primero que recibe el jugador
 * nada más crear el personaje. Usa lo que ya escribió (clase, build y
 * habilidad) y las reglas del consejero, sin IA y sin pedirle nada más.
 */
export function SkillGemTeaser({ profile, onOpenAdvisor }: SkillGemTeaserProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const skill = mainSkillOf(profile);
  const reading = readCharacterLevel(profile);
  const grade = teaserGradeFor(reading.known ? reading.level : null);
  const archetype = profile.archetype?.trim() ?? "";
  const characterClass = profile.characterClass.trim();
  const [answer, setAnswer] = useState<SupportAdviceResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (skill === null) return;
    let cancelled = false;
    setAnswer(null);
    setFailed(false);
    api
      .supportGemPreview({
        skill: skill.slice(0, 80),
        maxGrade: grade,
        attributes: ["Int", "Des", "Fue"],
        lang,
        build: {
          ...(archetype ? { archetype: archetype.slice(0, 200) } : {}),
          ...(characterClass && !UNKNOWN_CLASS.test(characterClass) ? { characterClass: characterClass.slice(0, 60) } : {}),
        },
      })
      .then((response) => {
        if (!cancelled) setAnswer(response);
      })
      .catch(() => {
        // Habilidad que la web no conoce o servidor ocupado: la tarjeta no
        // aparece. No es momento de decirle otro «no» al jugador.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [skill, grade, lang, archetype, characterClass]);

  if (skill === null || failed) return null;
  if (answer !== null && answer.recommended === null) return null;

  const shown = answer?.skill.name ?? skill;
  return (
    <section
      id="gemas-habilidad"
      className="rounded-xl border border-primary/35 bg-card p-4 sm:p-5"
      aria-labelledby="gemas-habilidad-titulo"
      data-testid="gemas-habilidad"
    >
      <h2 id="gemas-habilidad-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Gem className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {t.title(shown)}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.lead}</p>

      {answer === null || answer.recommended === null ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {t.loading}
        </p>
      ) : (
        <>
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2.5" data-testid="gemas-habilidad-primera">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t.first}</p>
            <p className="mt-0.5 text-base font-semibold text-foreground">
              {answer.recommended.name}{" "}
              <span className="text-xs font-normal text-muted-foreground">· {t.tier(ROMAN[answer.recommended.grade] ?? String(answer.recommended.grade))}</span>
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/90">{answer.recommended.reason}</p>
          </div>

          {answer.alternatives.length > 0 && (
            <div className="mt-3" data-testid="gemas-habilidad-otras">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.also}</p>
              <ul className="mt-1.5 space-y-1.5">
                {answer.alternatives.slice(0, 2).map((option) => (
                  <li key={option.name} className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">{option.name}</span>
                    {" — "}
                    {supportMainBenefit(option)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t.upTo(ROMAN[grade] ?? String(grade))}</p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onOpenAdvisor} data-testid="gemas-habilidad-abrir">
            {t.open}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </>
      )}
    </section>
  );
}
