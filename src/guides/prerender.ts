import type { ActGuide, GuideRoutePriority, GuideTip } from "./guide";
import { guidePageTitle } from "./index";

/**
 * Versión en HTML ya escrito de cada guía, para buscadores.
 *
 * La web se dibuja con JavaScript: sin esto, Google recibe un `<div id="root">`
 * vacío. Al compilar se genera `dist/guias/<slug>.html` con el título, la
 * descripción y todo el texto (también el plegado en «Más detalle»). Cuando
 * el navegador arranca la app, React sustituye este contenido por la página
 * interactiva, así que el visitante no ve dos versiones.
 */

const SITE_ORIGIN = "https://exilecopilot.com";
const SHARE_IMAGE = `${SITE_ORIGIN}/og/exile-copilot.jpg`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ROUTE_PRIORITY_LABEL: Record<GuideRoutePriority, string> = {
  clave: "no te lo saltes",
  recomendable: "merece la pena",
  historia: "historia",
};

function tipHtml(tip: GuideTip): string {
  const lead = tip.lead ? `<strong>${escapeHtml(tip.lead)}</strong> ` : "";
  return `<li>${lead}${escapeHtml(tip.text)}</li>`;
}

export function renderGuideArticle(guide: ActGuide): string {
  const parts: string[] = [];
  parts.push(`<article class="mx-auto max-w-3xl space-y-4 px-4 py-8" data-prerendered-guide="${escapeHtml(guide.slug)}">`);
  parts.push(
    `<p>Exile Copilot es un compañero en español para Path of Exile 2: guías por acto y un mentor que mira tu personaje. Gratis y sin registrarte.</p>`,
  );
  parts.push(`<h1>${escapeHtml(guide.title)}</h1>`);
  parts.push(`<p>${escapeHtml(guide.summary)}</p>`);
  parts.push(`<p>Comprobada para el parche ${escapeHtml(guide.checkedPatch)}. Se revisa al salir la 1.0.</p>`);
  parts.push(`<h2>Lo esencial</h2><ol>${guide.essentials.map(tipHtml).join("")}</ol>`);
  if (guide.route?.length) {
    parts.push(
      `<h2>Ruta del acto</h2><ol>${guide.route
        .map(
          (step) =>
            `<li><strong>${escapeHtml(step.zone)} (${ROUTE_PRIORITY_LABEL[step.priority]}):</strong> ${escapeHtml(step.text)}${
              step.gems?.length ? ` Gemas seguras: ${step.gems.map(escapeHtml).join("; ")}.` : ""
            }${step.skip ? ` Te puedes saltar: ${escapeHtml(step.skip)}.` : ""}</li>`,
        )
        .join("")}</ol>`,
    );
  }
  guide.blocks.forEach((block, index) => {
    parts.push(`<section><h2>${index + 1}. ${escapeHtml(block.title)}</h2>`);
    parts.push(`<p>${escapeHtml(block.intro)}</p>`);
    if (block.cards?.length) {
      parts.push(
        `<ul>${block.cards.map((card) => `<li><strong>${escapeHtml(card.title)}:</strong> ${escapeHtml(card.text)}</li>`).join("")}</ul>`,
      );
    }
    const tips = [...block.tips, ...(block.more ?? [])];
    if (tips.length > 0) parts.push(`<ul>${tips.map(tipHtml).join("")}</ul>`);
    parts.push(`</section>`);
  });
  parts.push(
    `<section><h2>¿Está listo tu personaje para el ${escapeHtml(guide.check.nextAct)}?</h2><p>Pega tus objetos copiados del juego con Ctrl+C, o tu código de Path of Building, y la guía te dice qué resistencia te falta.</p></section>`,
  );
  parts.push(
    `<section><h2>Fuentes</h2><ol>${guide.sources
      .map((source) => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.label)}</a></li>`)
      .join("")}</ol><p>Path of Exile 2 es de Grinding Gear Games; esta guía no es oficial.</p></section>`,
  );
  parts.push(`</article>`);
  return parts.join("\n");
}

/** Mete la guía en el HTML compilado de la app (`dist/index.html`). */
export function renderGuidePage(shell: string, guide: ActGuide): string {
  const title = escapeHtml(guidePageTitle(guide));
  const description = escapeHtml(guide.description);
  const head = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${SITE_ORIGIN}/guias/${escapeHtml(guide.slug)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:locale" content="es_ES" />`,
    `<meta property="og:site_name" content="Exile Copilot" />`,
    `<meta property="og:url" content="${SITE_ORIGIN}/guias/${escapeHtml(guide.slug)}" />`,
    `<meta property="og:image" content="${SHARE_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${SHARE_IMAGE}" />`,
  ].join("\n    ");
  if (!/<title>[^<]*<\/title>/.test(shell) || !shell.includes('<div id="root"></div>')) {
    throw new Error("El HTML base no tiene <title> o <div id=\"root\"></div>: no se puede generar la guía.");
  }
  // La portada trae sus etiquetas para compartir entre marcas: la guía pone las suyas.
  const withoutSocial = shell.replace(/\s*<!-- social:start[\s\S]*?<!-- social:end -->/, "");
  return withoutSocial
    .replace(/<title>[^<]*<\/title>/, head)
    .replace('<div id="root"></div>', `<div id="root">${renderGuideArticle(guide)}</div>`);
}
