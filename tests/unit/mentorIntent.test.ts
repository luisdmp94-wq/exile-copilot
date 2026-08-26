import { describe, expect, it } from "vitest";
import {
  classifyMentorQuestion,
  normalizeQuestion,
} from "../../shared/mentorIntent.js";
import { MENTOR_SUGGESTIONS } from "../../shared/mentorQuery.js";

/**
 * Hito 6A — clasificador determinista de intención.
 * Reconoce un puñado de formas habituales; ante la duda, `unsupported`.
 */

describe("normalización de la pregunta", () => {
  it("ignora mayúsculas, tildes, signos y espacios sobrantes", () => {
    expect(normalizeQuestion("¿QUÉ MEJORO AHORA?")).toBe("que mejoro ahora");
    expect(normalizeQuestion("  ¿Por   qué?  ")).toBe("por que");
    expect(normalizeQuestion("¡¿Qué hago primero?!")).toBe("que hago primero");
    // NFD pliega «ñ» a «n» y «ü» a «u»: buscado, hace el reconocimiento más
    // tolerante y ningún patrón depende de esas letras.
    expect(normalizeQuestion("Añadir")).toBe("anadir");
    expect(normalizeQuestion("pingüino")).toBe("pinguino");
  });

  it("una pregunta escrita de varias formas se normaliza igual", () => {
    const variantes = ["¿Qué mejoro ahora?", "que mejoro ahora", "QUE MEJORO AHORA!!!"];
    const normalizadas = new Set(variantes.map(normalizeQuestion));
    expect(normalizadas.size).toBe(1);
  });
});

describe("intención next_improvement", () => {
  it("reconoce las formas habituales de pedir el siguiente paso", () => {
    for (const pregunta of [
      "¿Qué mejoro ahora?",
      "que mejoro",
      "¿Qué debería hacer primero?",
      "¿Qué hago ahora?",
      "¿Cuál es el siguiente paso?",
      "¿Por dónde empiezo?",
      "QUÉ TOCA",
    ]) {
      expect(classifyMentorQuestion(pregunta).intent, pregunta).toBe("next_improvement");
    }
  });
});

describe("intención explain_priority", () => {
  it("reconoce peticiones de explicación y de diagnóstico principal", () => {
    for (const pregunta of [
      "¿Por qué me recomiendas esto?",
      "porque",
      "¿Cuál es mi principal problema?",
      "¿Cuál es mi problema principal?",
      "Explícame la prioridad",
      "¿Cuál es el motivo?",
    ]) {
      expect(classifyMentorQuestion(pregunta).intent, pregunta).toBe("explain_priority");
    }
  });

  it("«por qué» gana a «qué hago» cuando aparecen juntos", () => {
    // Es una petición de explicación, no de un paso nuevo.
    expect(classifyMentorQuestion("¿Por qué me dices que haga eso?").intent).toBe(
      "explain_priority",
    );
  });
});

describe("intención unsupported", () => {
  it("no adivina preguntas fuera del alcance", () => {
    for (const pregunta of [
      "¿Cuánto vale mi arma?",
      "¿Cuál es la mejor build del meta?",
      "¿Me subes de nivel?",
      "dime el DPS de mi personaje",
      "?????",
    ]) {
      expect(classifyMentorQuestion(pregunta).intent, pregunta).toBe("unsupported");
    }
  });

  it("una pregunta vacía tras normalizar tampoco se adivina", () => {
    expect(classifyMentorQuestion("¿¿¿???").intent).toBe("unsupported");
    expect(classifyMentorQuestion("   ").intent).toBe("unsupported");
  });
});

describe("intención conversation", () => {
  it("un saludo o agradecimiento nunca se convierte en una recomendación", () => {
    for (const pregunta of ["hola", "¡Buenos días!", "gracias", "ok, entendido"]) {
      expect(classifyMentorQuestion(pregunta).intent, pregunta).toBe("conversation");
    }
  });

  it("una pregunta de juego conserva prioridad aunque empiece saludando", () => {
    expect(classifyMentorQuestion("Hola, ¿qué mejoro ahora?").intent).toBe(
      "next_improvement",
    );
  });

  it("reconoce identidad y capacidades básicas con o sin tildes", () => {
    for (const pregunta of [
      "¿Quién eres?",
      "quien eres",
      "¿Qué eres?",
      "¿Cómo te llamas?",
      "¿Qué puedes hacer?",
      "¿Para qué sirves?",
    ]) {
      expect(classifyMentorQuestion(pregunta).intent, pregunta).toBe("conversation");
    }
  });
});

describe("sugerencias de la interfaz", () => {
  it("todas las sugerencias que ofrece la UI están soportadas", () => {
    for (const sugerencia of MENTOR_SUGGESTIONS) {
      expect(classifyMentorQuestion(sugerencia).intent, sugerencia).not.toBe("unsupported");
    }
  });
});

describe("determinismo", () => {
  it("la misma pregunta produce siempre la misma clasificación", () => {
    const a = classifyMentorQuestion("¿Qué mejoro ahora?");
    const b = classifyMentorQuestion("¿Qué mejoro ahora?");
    expect(a).toEqual(b);
  });
});
