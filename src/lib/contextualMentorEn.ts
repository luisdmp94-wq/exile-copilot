import type { ItemSlot } from "@shared/domain.js";
import { GEAR_LABELS, type ContextualMentorCue, type ContextualMentorEvent } from "./contextualMentor";

/**
 * Mensajes de la mascota del Mentor en inglés. Solo los de las partes ya
 * traducidas (portada, guías, personaje); los de Plan y Crafting siguen en
 * español hasta su bloque, y para ellos esto devuelve null.
 */
const SLOT_LABELS_EN: Record<ItemSlot, string> = {
  weapon: "Weapon",
  offhand: "Off-hand",
  helmet: "Helmet",
  body: "Body armour",
  gloves: "Gloves",
  boots: "Boots",
  belt: "Belt",
  amulet: "Amulet",
  ring1: "Ring 1",
  ring2: "Ring 2",
  flask: "Flask",
  charm: "Charm",
  other: "Other",
};

const AREA_EN: Record<string, string> = {
  mentor: "the mentor",
  mercado: "the market",
  recomendaciones: "recommendations",
  diario: "the journal",
};

export function englishMentorCue(event: ContextualMentorEvent): ContextualMentorCue | null {
  switch (event.type) {
    case "welcome":
      return {
        id: "welcome",
        source: "guide",
        eyebrow: "First step",
        title: "I need to know your character",
        message:
          "Load an example or import your data. Until then I won't attribute gear, problems or decisions to a character that doesn't exist.",
        ask: null,
      };
    case "ready":
      return {
        id: `ready:${event.profileName}`,
        source: "guide",
        eyebrow: "Mentor here",
        title: `I've loaded ${event.profileName}'s file`,
        message:
          "Open an item, change your goal or generate recommendations: I'll explain what each decision means without losing context.",
        ask: {
          question: "What should I improve first on my current character?",
          intent: "next_improvement",
        },
      };
    case "profileIncomplete":
      return {
        id: `profile-incomplete:${event.profileName}:${event.missing.join("|")}`,
        source: "warning",
        eyebrow: "Missing details",
        title: `I need more details on ${event.profileName}`,
        message:
          event.missing.length === 1 && GEAR_LABELS.has(event.missing[0] ?? "")
            ? "To recommend gear I need to see at least one of your items. Meanwhile, the quick review already tells you what's holding you back."
            : event.missing.length > 0
              ? `Still missing: ${event.missing.join(", ")}. Fill it in and I'll tell you what to improve first.`
              : "Fill in your character's details and I'll tell you what to improve first.",
        ask: null,
      };
    case "workspace":
      if (event.workspace === "guias") {
        return {
          id: "workspace:guias",
          source: "guide",
          eyebrow: "Guides",
          title: "You're in the act guides",
          message: "Take your time. Each guide lets you check whether your character is ready for the next act.",
          ask: null,
        };
      }
      if (event.workspace === "expediente") {
        return {
          id: "workspace:expediente",
          source: "guide",
          eyebrow: "Change of context",
          title: "You're back at your character",
          message: "Your real character rules here: gear, memory, the open case and the one next action.",
          ask: {
            question: "What is my character's main problem right now?",
            intent: "explain_priority",
          },
        };
      }
      return null;
    case "item": {
      const name = event.item.name || event.item.baseType || "this item";
      const slot = SLOT_LABELS_EN[event.item.slot];
      return {
        id: `item:${event.item.id}`,
        source: "guide",
        eyebrow: `Inspecting ${slot.toLowerCase()}`,
        title: name,
        message:
          "Don't judge the item on its own: check which problem it solves, what you'd lose by replacing it and whether it's tied to the open case.",
        ask: {
          question: `I'm looking at ${name} in ${slot}. Why is it related to my priority and what should I check before changing it?`,
          intent: "explain_priority",
        },
      };
    }
    case "editor":
      return {
        id: "editor:open",
        source: "guide",
        eyebrow: "Diagnosis quality",
        title: "The better the file, the better the advice",
        message: "Only correct data you can confirm. An unknown value is more useful than a made-up zero.",
        ask: {
          question: "What should I improve first when completing my file?",
          intent: "next_improvement",
        },
      };
    case "profileSaved":
      return {
        id: "profile:saved",
        source: "engine",
        eyebrow: "File updated",
        title: "The changes are now part of the diagnosis",
        message:
          "Earlier recommendations and answers may be out of date. Generate a new diagnosis before spending anything.",
        ask: {
          question: "I've saved my file. What should I improve first now?",
          intent: "next_improvement",
        },
      };
    case "error":
      return {
        id: `error:${event.area}:${event.message}`,
        source: "warning",
        eyebrow: "Couldn't update the context",
        title: `Problem with ${AREA_EN[event.area] ?? event.area}`,
        message: event.message,
        ask: null,
      };
    default:
      return null;
  }
}
