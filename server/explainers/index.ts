import type { Recommendation } from "../../shared/domain.js";
import type { ServerConfig } from "../config.js";

/**
 * Capa de explicación. El motor NUNCA depende de un explainer: las rutas
 * pueden enriquecer `reason` con el proveedor activo.
 *
 * - DeterministicExplainer (por defecto): plantillas en español a partir de
 *   los datos estructurados de la Recommendation. Sin API key, sin inventar datos.
 * - LlmExplainer: stub desactivado por flag EXPLAINER_LLM_ENABLED=false.
 */

export interface ExplainerContext {
  budgetText?: string;
  goalKind?: string;
}

export interface ExplainerProvider {
  readonly name: string;
  explain(rec: Recommendation, ctx: ExplainerContext): Promise<string>;
}

function costText(rec: Recommendation): string {
  const c = rec.cost;
  if (!c.known || c.min === null) return "Coste: No verificado.";
  const range = c.max !== null && c.max !== c.min ? `${c.min}–${c.max}` : `${c.min}`;
  return `Coste estimado: ${range} ${c.currency} (poe.ninja).`;
}

function riskText(rec: Recommendation): string {
  const parts = [`Riesgo ${rec.risk.level}: ${rec.risk.description}`];
  if (rec.mayLoseValuableMods) parts.push("Puede implicar perder mods valiosos de tu equipo actual.");
  if (rec.irreversible) parts.push("Es una acción irreversible.");
  return parts.join(" ");
}

export class DeterministicExplainer implements ExplainerProvider {
  readonly name = "deterministic";

  explain(rec: Recommendation, ctx: ExplainerContext): Promise<string> {
    const lines = [
      rec.reason,
      `Impacto esperado (${rec.impact.magnitude}): ${rec.impact.description}`,
      costText(rec),
      riskText(rec),
      `Confianza: ${rec.confidence}. Datos actualizados: ${rec.dataUpdatedAt}. Parche: ${rec.patch}.`,
    ];
    if (ctx.goalKind) lines.push(`Esta recomendación pondera tu objetivo: ${ctx.goalKind}.`);
    if (rec.unverified.length > 0) {
      lines.push(`Pendiente de verificar: ${rec.unverified.join(" ")}`);
    }
    return Promise.resolve(lines.join("\n"));
  }
}

export class LlmExplainer implements ExplainerProvider {
  readonly name = "llm";
  readonly #enabled: boolean;

  constructor(config: ServerConfig) {
    this.#enabled = config.explainerLlmEnabled;
  }

  explain(_rec: Recommendation, _ctx: ExplainerContext): Promise<string> {
    if (!this.#enabled) {
      return Promise.reject(
        new Error(
          "LlmExplainer desactivado: EXPLAINER_LLM_ENABLED=false. Usa DeterministicExplainer (sin API key).",
        ),
      );
    }
    // Rama futura: aquí iría la llamada al proveedor LLM configurado.
    return Promise.reject(new Error("LlmExplainer habilitado pero sin proveedor configurado."));
  }
}

/** Devuelve el explainer activo según la configuración. */
export function getExplainer(config: ServerConfig): ExplainerProvider {
  return config.explainerLlmEnabled ? new LlmExplainer(config) : new DeterministicExplainer();
}
