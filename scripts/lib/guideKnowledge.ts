/**
 * Las guías por acto de la web (src/guides), en la forma que lee el Mentor:
 * solo texto, sin fuentes ni direcciones. El servidor no puede importar
 * `src/` en producción, así que se guardan en `server/data/guideKnowledge.json`
 * con `npm run data:guides`. Una prueba falla si el archivo se queda atrás.
 */
import { GUIDES, GUIDES_EN } from "../../src/guides/index.js";
import type { ActGuide } from "../../src/guides/guide.js";
import type { GuideKnowledge, GuideKnowledgeAct } from "../../server/mentor/guideKnowledge.js";

function actKnowledge(guide: ActGuide): GuideKnowledgeAct {
  return {
    act: guide.act,
    slug: guide.slug,
    label: guide.actLabel,
    title: guide.title,
    draft: guide.status === "borrador",
    checkedPatch: guide.checkedPatch,
    essentials: guide.essentials.map((tip) => tip.text),
    focusNote: guide.check.focus?.note ?? null,
    blocks: guide.blocks.map((block) => ({
      id: block.id,
      title: block.title,
      intro: block.intro,
      cards: (block.cards ?? []).map((card) => `${card.title}: ${card.text}`),
      lines: [...block.tips, ...(block.more ?? [])].map((tip) => `${tip.lead ? `${tip.lead} ` : ""}${tip.text}`),
      // Lo que es de la pelea contra el jefe final: las tarjetas (salvo las de otro
      // jefe) y los consejos marcados. Con esto el Mentor no mezcla jefes.
      finalCards: (block.id === "jefes" ? (block.cards ?? []) : []).filter((card) => card.otherBoss !== true).map((card) => `${card.title}: ${card.text}`),
      finalLines: [...block.tips, ...(block.more ?? [])]
        .filter((tip) => tip.finalBoss === true)
        .map((tip) => `${tip.lead ? `${tip.lead} ` : ""}${tip.text}`),
    })),
    route: (guide.route ?? []).map((step) => ({
      zone: step.zone,
      text: step.text,
      optional: step.optional === true,
      priority: step.priority,
      reward: step.reward ?? null,
    })),
  };
}

export function buildGuideKnowledge(): GuideKnowledge {
  return { es: GUIDES.map(actKnowledge), en: GUIDES_EN.map(actKnowledge) };
}
