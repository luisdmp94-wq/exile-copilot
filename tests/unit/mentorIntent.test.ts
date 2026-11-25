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

describe("pedir ayuda sin más es pedir el siguiente paso", () => {
  it("entiende «estoy atascado» y las formas normales de pedir ayuda", () => {
    for (const pregunta of [
      // La pregunta real de Luis en la web publicada (25-11-2026).
      "estoy atascado con mi personaje puedes ayudarme , no se como podria mejorarlo",
      "estoy atascado",
      "Estoy atascada en el acto 2",
      "ayúdame con mi personaje",
      "¿me ayudas?",
      "necesito ayuda",
      "¿cómo mejoro mi personaje?",
      "cómo puedo mejorar",
      "estoy perdido",
      "no sé cómo seguir",
      "I'm stuck, can you help me?",
      "how do I improve my character",
      "I need help",
      "I'm lost",
    ]) {
      expect(classifyMentorQuestion(pregunta).intent, pregunta).toBe("next_improvement");
    }
  });

  it("si además dice que muere o que le falta daño, conserva ese foco", () => {
    expect(classifyMentorQuestion("estoy atascado, me matan todo el rato")).toMatchObject({ focus: "survival" });
    expect(classifyMentorQuestion("ayúdame, no hago daño")).toMatchObject({ focus: "damage" });
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

  it("las preguntas de ejemplo de «Tu siguiente paso» están soportadas (src/components/MentorQuickAsk.tsx)", () => {
    for (const ejemplo of [
      "¿Por qué muero tanto?",
      "¿Qué mejoro ahora?",
      "¿Cuál es mi principal problema?",
      "Why do I keep dying?",
      "What should I improve now?",
      "What's my main problem?",
    ]) {
      expect(classifyMentorQuestion(ejemplo).intent, ejemplo).not.toBe("unsupported");
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

describe("foco supervivencia («¿por qué muero?»)", () => {
  it("marca las preguntas sobre morir o aguantar como supervivencia", () => {
    for (const question of [
      "¿Por qué muero tanto?",
      "me matan mucho en mapas",
      "Hola, me revientan los jefes",
      "no aguanto nada",
      "¿cómo sobrevivir más?",
    ]) {
      const result = classifyMentorQuestion(question);
      expect(result.focus).toBe("survival");
      expect(result.intent).toBe("explain_priority");
    }
  });

  it("las demás preguntas no llevan ese foco", () => {
    expect(classifyMentorQuestion("¿Qué mejoro ahora?").focus).toBeNull();
    expect(classifyMentorQuestion("¿Por qué me recomiendas esto?").focus).toBeNull();
    expect(classifyMentorQuestion("hola").focus).toBeNull();
  });
});

describe("foco daño («me falta daño»)", () => {
  it("marca las preguntas sobre poco daño como daño", () => {
    for (const question of [
      "me falta daño",
      "¿Por qué hago tan poco daño?",
      "Hola, no mato nada",
      "tardo mucho en matar a los jefes",
      "¿qué mejoro para tener más daño?",
      "I need more damage",
      "how do I kill faster?",
    ]) {
      expect(classifyMentorQuestion(question).focus, question).toBe("damage");
    }
    expect(classifyMentorQuestion("me falta daño").intent).toBe("explain_priority");
    expect(classifyMentorQuestion("¿qué mejoro para tener más daño?").intent).toBe("next_improvement");
  });

  it("pedir la cifra de daño no es quejarse de poco daño", () => {
    for (const question of ["¿Cuánto daño hago?", "dime mi DPS", "What's my damage?"]) {
      expect(classifyMentorQuestion(question), question).toMatchObject({ intent: "unsupported", focus: null });
    }
  });

  it("recibir daño es aguante, no daño", () => {
    expect(classifyMentorQuestion("recibo mucho daño").focus).toBe("survival");
    expect(classifyMentorQuestion("I take too much damage").focus).toBe("survival");
    expect(classifyMentorQuestion("¿por qué muero si tengo mucho daño?").focus).toBe("survival");
  });

  it("quien recibe el daño manda: «el jefe me hace mucho daño» es aguante", () => {
    for (const question of [
      "el jefe me hace mucho daño",
      "recibo demasiado daño",
      "me hacen demasiado daño",
      "me meten mucho daño los élites",
      "¿qué resistencias necesito contra el daño de fuego?",
      "I'm taking a lot of damage",
      "I take way too much damage in act 3",
      "bosses deal a lot of damage",
      "I keep getting killed",
    ]) {
      expect(classifyMentorQuestion(question).focus, question).toBe("survival");
    }
  });

  it("que el enemigo no muera es falta de daño, no «por qué muero»", () => {
    for (const question of [
      "el jefe no se muere",
      "los enemigos no mueren",
      "los jefes tardan en morir",
      "the boss won't die",
      "bosses take forever to die",
    ]) {
      expect(classifyMentorQuestion(question).focus, question).toBe("damage");
    }
    // Y lo de siempre sigue igual.
    expect(classifyMentorQuestion("me falta daño").focus).toBe("damage");
    expect(classifyMentorQuestion("¿por qué muero tanto?").focus).toBe("survival");
    expect(classifyMentorQuestion("no me muero nunca pero no mato").focus).toBe("survival");
  });

  it("«mi mayor problema» se entiende, y «what's my main problem» no es pedir una cifra", () => {
    expect(classifyMentorQuestion("¿cuál es mi mayor problema?").intent).toBe("explain_priority");
    expect(classifyMentorQuestion("what is my biggest problem").intent).toBe("explain_priority");
    expect(classifyMentorQuestion("What's my main problem? I do no damage")).toMatchObject({ intent: "explain_priority", focus: "damage" });
    // Pedir la cifra sigue sin foco de daño.
    expect(classifyMentorQuestion("what's my dps?").focus).toBeNull();
    expect(classifyMentorQuestion("¿cuánto daño hago?").focus).toBeNull();
  });
});

describe("preguntas en inglés", () => {
  it("reconoce las preguntas habituales en inglés", () => {
    expect(classifyMentorQuestion("Why do I keep dying?")).toMatchObject({ intent: "explain_priority", focus: "survival" });
    expect(classifyMentorQuestion("What should I improve first?").intent).toBe("next_improvement");
    expect(classifyMentorQuestion("What is wrong with my build?").intent).toBe("explain_priority");
    expect(classifyMentorQuestion("hello").intent).toBe("conversation");
    expect(classifyMentorQuestion("thanks a lot").intent).toBe("conversation");
    expect(classifyMentorQuestion("Who are you?").intent).toBe("conversation");
  });
});
