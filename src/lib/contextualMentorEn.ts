import type { CurrencyKind, GoalKind, ItemSlot } from "@shared/domain.js";
import { CRAFTING_GOAL_LABELS_EN } from "@shared/craftingGoal.js";
import { COACH_FOCUS_LABELS_EN } from "@shared/craftingFocus.js";
import {
  COACH_DIRECTION_LABELS_EN,
  COACH_ROLL_MINIMUM_LABELS_EN,
} from "@shared/craftingCoachLabels.js";
import { craftingBuildIntentLabel } from "@shared/craftingBuildIntentLabel.js";
import { craftingSuccessCriterionLabel } from "@shared/craftingSuccessCriteria.js";
import { CRAFTING_ACTION_LABELS_EN } from "@shared/craftingWorkshopText.js";
import {
  GEAR_LABELS,
  contextualMentorCue,
  type ContextualMentorCue,
  type ContextualMentorEvent,
} from "./contextualMentor";
import { englishProfileValue } from "./format";

/**
 * Mensajes de la mascota del Mentor en inglés.
 *
 * El id, el tipo y el estado de crafting salen siempre del aviso español: aquí
 * solo se cambian los textos. Las etiquetas (enfoque, tirada, moneda…) se
 * calculan desde su id, porque el evento puede haberse lanzado en español.
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

const GOAL_LABELS_EN: Record<GoalKind, string> = {
  damage: "Damage",
  survival: "Survival",
  mapping: "Mapping",
  bossing: "Bossing",
  balanced: "Balanced",
};

const CURRENCY_LABELS_EN: Record<CurrencyKind, string> = {
  chaos: "Chaos",
  exalted: "Exalted",
  divine: "Divine",
  gold: "Gold",
};

interface EnglishCopy {
  eyebrow: string;
  title: string;
  message: string;
  /** Pregunta para el mentor; solo se usa si el aviso español lleva una. */
  question?: string;
}

/** «1 step» / «2 steps». */
function count(amount: number, singular: string, plural = `${singular}s`): string {
  return `${amount} ${amount === 1 ? singular : plural}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase("en") + text.slice(1);
}

function englishCopy(event: ContextualMentorEvent): EnglishCopy {
  switch (event.type) {
    case "welcome":
      return {
        eyebrow: "First step",
        title: "I need to know your character",
        message:
          "Load an example or import your data. Until then I won't attribute gear, problems or decisions to a character that doesn't exist.",
      };
    case "ready":
      return {
        eyebrow: "Mentor here",
        title: `${englishProfileValue(event.profileName)} is loaded`,
        message:
          "Open an item, change your goal or generate recommendations: I'll explain what each decision means without losing context.",
        question: "What should I improve first on my current character?",
      };
    case "profileIncomplete":
      return {
        eyebrow: "Missing details",
        title: `I need more details on ${englishProfileValue(event.profileName)}`,
        message:
          event.missing.length === 1 && GEAR_LABELS.has(event.missing[0] ?? "")
            ? "To recommend gear I need to see at least one of your items. Meanwhile, the quick review already tells you what's holding you back."
            : event.missing.length > 0
              ? `Still missing: ${event.missing.join(", ")}. Fill it in and I'll tell you what to improve first.`
              : "Fill in your character's details and I'll tell you what to improve first.",
      };
    case "workspace":
      if (event.workspace === "crafting") {
        return {
          eyebrow: "Workbench",
          title: "You're in Crafting",
          message:
            "Here you work on one item with one currency at a time. Check the item before you spend, then come back and paste the result so we can compare.",
          question:
            "Why is the selected item related to my priority, and what should I check before changing it?",
        };
      }
      if (event.workspace === "guias") {
        return {
          eyebrow: "Guides",
          title: "You're in the act guides",
          message: "Take your time. Each guide lets you check whether your character is ready for the next act.",
        };
      }
      if (event.workspace === "plan") {
        return {
          eyebrow: "Change of context",
          title: "You're in Plan & market",
          message:
            "This is where you decide where to take the build and how much you can spend. Changing these values can change the priority of the diagnosis.",
          question: "What should I improve first with my current goal and budget?",
        };
      }
      return {
        eyebrow: "Change of context",
        title: "You're back at your character",
        message: "Your real character rules here: gear, memory, the open case and the one next action.",
        question: "What is my character's main problem right now?",
      };
    case "item": {
      const name = event.item.name || event.item.baseType || "this item";
      const slot = SLOT_LABELS_EN[event.item.slot];
      return {
        eyebrow: `Inspecting ${slot.toLowerCase()}`,
        title: name,
        message:
          "Don't judge the item on its own: check which problem it solves, what you'd lose by replacing it and whether it's tied to the open case.",
        question: `I'm looking at ${name} in ${slot}. Why is it related to my priority and what should I check before changing it?`,
      };
    }
    case "craftingItem": {
      const name = event.item.name || event.item.baseType || "this item";
      return {
        eyebrow: "Item selected",
        title: name,
        message:
          "First choose what you want to improve. Then decide what you don't want to lose and a visible condition for stopping.",
        question: `I'm getting ${name} ready for crafting. Why is it related to my priority and what should I check before spending?`,
      };
    }
    case "craftingCoachProject": {
      const unique = event.intent === "unique-acquisition";
      return {
        eyebrow: unique ? "Unique item detected" : "Endgame project detected",
        title: unique ? "Don't spend on this item yet" : "Define the whole project",
        message: event.reason,
      };
    }
    case "craftingCoachExample":
      return {
        eyebrow: "Crafting simulation",
        title: event.itemName,
        message:
          event.origin === "practice"
            ? "This practice item isn't in your account either. Use it to understand the recommendation, but don't spend currency or paste a real result. Go back to your item or paste a real PoE2 item."
            : "This item belongs to the example character and isn't in your account. Don't spend any currency: use a practice item or paste a real PoE2 item.",
      };
    case "craftingCoachDirection": {
      const direction = event.direction
        ? COACH_DIRECTION_LABELS_EN[event.direction]
        : event.direction === null
          ? "goal not decided yet"
          : event.directionLabel;
      const roll = COACH_ROLL_MINIMUM_LABELS_EN[event.rollMinimum];
      const protectedLines = event.protectedLineCount ?? 0;
      const unresolvedLines = event.unresolvedProtectionCount ?? 0;
      const protection = protectedLines > 0
        ? ` I've linked ${count(protectedLines, "existing line")} you don't want to lose.`
        : "";
      const unresolved = unresolvedLines > 0
        ? ` ${count(unresolvedLines, "protection")} still ${unresolvedLines === 1 ? "isn't" : "aren't"} linked; I won't treat ${unresolvedLines === 1 ? "it" : "them"} as fact.`
        : "";
      const budget = event.budgetSummary ? ` ${event.budgetSummary}` : "";
      const verdict = `${event.baseVerdictTitle}. ${event.baseVerdictSummary} Your goal is “${event.playerGoal}”.`;
      const baseMessage = event.stepKind === "use-currency"
        ? `${verdict} The guide has narrowed it down to “${event.nextStepTitle}”. You stop at ${roll}, after ${count(event.attemptLimit, "step")} at most.`
        : event.stepKind === "needs-data"
          ? `${verdict} Before you spend, the guide needs “${event.nextStepTitle}”. Fill that in so I don't have to guess an action.`
          : `${verdict} The guide recommends stopping: “${event.nextStepTitle}”.`;
      return {
        eyebrow: "Base checked",
        title: `${capitalise(direction)} · ${event.itemName}`,
        message: `${baseMessage}${protection}${unresolved}${budget}`,
        question: event.stepKind === "use-currency"
          ? `I want “${event.playerGoal}” with ${event.itemName}. The app suggests “${event.nextStepTitle}”. Why is that the next step and what should I check first?`
          : `I want “${event.playerGoal}” with ${event.itemName}, but the app says “${event.nextStepTitle}”. Explain what's missing or why I should stop before spending.`,
      };
    }
    case "craftingCoachContract": {
      const focus = COACH_FOCUS_LABELS_EN[event.focus];
      const roll = COACH_ROLL_MINIMUM_LABELS_EN[event.rollMinimum];
      const steps = count(event.attemptLimit, "step");
      return {
        eyebrow: "Limits updated",
        title: `${capitalise(focus)} · ${roll}`,
        message:
          `You'll only accept the result if it adds ${focus} with ${roll}. The limit for this base is ${steps}; once you reach it, stop and reassess. The roll is measured within the visible range, not as a probability.`,
        question:
          `I'm crafting ${event.itemName} for “${event.playerGoal}”. I've set ${roll} and a maximum of ${steps}. Why should I stick to this stopping point before spending?`,
      };
    }
    case "craftingCoachResult": {
      // Los mismos límites que el aviso español: nunca «Step 2 of 1».
      const attemptLimit = Math.max(1, Math.floor(event.attemptLimit));
      const attemptCurrent = Math.max(1, Math.min(Math.floor(event.attemptCurrent), attemptLimit));
      const attemptsRemaining = Math.max(
        0,
        Math.min(Math.floor(event.attemptsRemaining), attemptLimit - attemptCurrent),
      );
      const roll = COACH_ROLL_MINIMUM_LABELS_EN[event.rollMinimum];
      const next = event.nextStepTitle === null
        ? "The guide isn't suggesting another spend yet."
        : `The next decision you can check is “${event.nextStepTitle}”.`;
      const remaining = attemptsRemaining === 0
        ? "No steps left within the limit."
        : `${count(attemptsRemaining, "step")} left within the limit.`;
      return {
        eyebrow: "Result read",
        title: event.headline,
        message: `Step ${attemptCurrent} of ${attemptLimit}. ${remaining} Goal: “${event.playerGoal}”. ${event.verdictText} ${next}`,
        question: `After step ${attemptCurrent} of ${attemptLimit} crafting ${event.itemName}, the result says “${event.headline}” and I was after “${event.playerGoal}” with ${roll}. ${event.verdictText} Explain why I should continue, stop or change base.`,
      };
    }
    case "craftingAdvancedPlan": {
      const state = event.state;
      const goal = CRAFTING_GOAL_LABELS_EN[state.goalCategory];
      const protectedCopy = state.protectedModifierCount === 0
        ? "no protected lines"
        : count(state.protectedModifierCount, "protected line");
      const stopCopy = state.stopCriteria.length === 0
        ? "no stop condition"
        : count(state.stopCriteria.length, "stop condition");
      const actionLabel = state.action === null
        ? state.tool === "currency"
          ? "no currency chosen"
          : state.tool === "essence"
            ? "Essence checks not complete yet"
            : "Alloy checks not complete yet"
        : CRAFTING_ACTION_LABELS_EN[state.action] ?? "currency";
      const buildCopy = state.buildIntent === null
        ? "fit with your character not checked"
        : state.buildIntent.alignment === "aligned"
          ? `fits ${craftingBuildIntentLabel(state.buildIntent, "en")}`
          : state.buildIntent.alignment === "choice-required"
            ? `your character points to ${craftingBuildIntentLabel(state.buildIntent, "en")}; you still need to choose`
            : state.buildIntent.alignment === "conflict"
              ? `fit to review: the context points to ${craftingBuildIntentLabel(state.buildIntent, "en")}`
              : "your character doesn't show a priority for this item";
      const phaseCopy = {
        blocked: "reading blocked",
        base: "choosing a base",
        foundation: "laying the foundation",
        finishing: "finishing the craft",
        recovery: "recovery",
        finished: "project finished",
      }[state.projectPhase];
      const baseDecisionCopy = {
        hold: "don't invest yet",
        continue: "the base can continue",
        recover: "consider recovery",
        "change-base": "change base",
        stop: "keep it and stop",
      }[state.baseDecision];
      const projectMemory = state.attemptCount === 0
        ? "No attempts recorded yet"
        : `${count(state.attemptCount, "attempt")} recorded; last result: ${
            state.latestBranch === "success"
              ? "goal reached"
              : state.latestBranch === "failure"
                ? "route exhausted"
                : "usable result"
          }`;
      const targetEvidenceCopy = state.targetEvidence === "target-on-current"
        ? "The goal is already visible on the current base"
        : state.targetEvidence === "target-observed-locally"
          ? "the goal shows up on another comparable imported base"
          : state.targetEvidence === "partial-local-evidence"
            ? `${count(state.localObservationCount ?? 0, "local signal")}, but the full goal isn't proven`
            : state.targetEvidence === "unobserved"
              ? "the goal doesn't show up in your local data yet"
              : "local data for the goal not checked";
      const poolCopy = state.modPoolCoverage === "available-complete"
        ? "full modifier pool available"
        : state.modPoolCoverage === "available-partial"
          ? "partial modifier pool, no usable odds"
          : state.modPoolCoverage === "unavailable"
            ? "no approved modifier pool"
            : "modifier pool coverage pending";
      const status = state.stopAlreadyReached
        ? "The condition is already met: don't spend chasing the same result."
        : state.ready
          ? "The plan and the pre-spend checks are complete; take one last look before opening the session."
          : "The plan doesn't allow spending yet: complete what's missing before preparing the session.";
      return {
        eyebrow: "Advanced project",
        title: `${goal} · ${event.itemName}`,
        message: `Phase: ${phaseCopy} · decision: ${baseDecisionCopy}. ${targetEvidenceCopy}; ${poolCopy}. ${projectMemory}. ${buildCopy} · ${protectedCopy} · ${stopCopy} · ${actionLabel}. ${status}`,
        question:
          `I'm reviewing the advanced project for ${event.itemName}: phase ${phaseCopy}, decision ${baseDecisionCopy}, ${targetEvidenceCopy}, ${poolCopy}, ${projectMemory}, goal ${goal}, ${buildCopy}, ${protectedCopy}, ${stopCopy} and ${actionLabel}. Explain what's missing, which branch I'd follow after the result, or why it's already ready, without changing the bench's decision.`,
      };
    }
    case "craftingGoal": {
      if (event.goal === "other") {
        return {
          eyebrow: "Goal pending",
          title: "Describe the result you're after",
          message:
            "The app won't interpret a free-text goal while it's still empty. Write it in your own words before preparing the spend.",
        };
      }
      const goalLabel = CRAFTING_GOAL_LABELS_EN[event.goal];
      const lower = goalLabel.toLocaleLowerCase("en");
      return {
        eyebrow: "Item goal",
        title: `${goalLabel} on ${event.itemName}`,
        message: event.nextTarget === null
          ? `${count(event.currentCount, "modifier")} tagged ${lower} ${event.currentCount === 1 ? "is" : "are"} already visible. Set another stop condition you can check.`
          : `${event.currentCount} visible. You can stop when you reach ${event.nextTarget}; that confirms one more tag, not that the modifier is good for your build.`,
        question: `I'm crafting ${event.itemName} to improve ${lower}. Why could that be my priority and what should I check before spending?`,
      };
    }
    case "craftingStop": {
      const label = event.criterion
        ? craftingSuccessCriterionLabel(event.criterion, "en")
        : event.criterionLabel;
      return {
        eyebrow: "Stopping point set",
        title: label,
        message:
          "The comparison will check this condition against the item text you paste afterwards. Meeting it doesn't replace your own final judgement of the item.",
        question: `I've set “${label}” while crafting ${event.itemName}. Why should I check this signal before continuing?`,
      };
    }
    case "craftingAction": {
      const label = (event.actionId ? CRAFTING_ACTION_LABELS_EN[event.actionId] : undefined) ?? event.actionLabel;
      return {
        eyebrow: "Spend prepared",
        title: label,
        message:
          "Check the exact variant and confirm the item is still the same. Being compatible doesn't predict which modifier you'll get.",
        question: `I'm about to use ${label} on ${event.itemName}. Why should I check this step before spending?`,
      };
    }
    case "editor":
      return {
        eyebrow: "Diagnosis quality",
        title: "The more I know about your character, the better the advice",
        message: "Only correct data you can confirm. An unknown value is more useful than a made-up zero.",
        question: "What should I improve first when completing my character?",
      };
    case "goal":
      return {
        eyebrow: "Goal updated",
        title: GOAL_LABELS_EN[event.goal],
        message: "The engine will weigh upgrades again with this goal. Earlier recommendations no longer apply.",
        question: `I've changed my goal to ${GOAL_LABELS_EN[event.goal]}. What should I improve first now?`,
      };
    case "budget": {
      const budget = `${event.amount} ${CURRENCY_LABELS_EN[event.currency]}`;
      return {
        eyebrow: "Budget updated",
        title: budget,
        message:
          "This limit only lets me confirm costs when there are prices and exchange rates I can verify; it doesn't turn estimates into safe purchases.",
        question: `With a budget of ${budget}, what should I improve first?`,
      };
    }
    case "league":
      return {
        eyebrow: "Market updated",
        title: event.league,
        message: "Prices depend on the league. Check the market again before using an older price.",
        question: `I'm playing in ${event.league}. What should I improve first with this league selected?`,
      };
    case "recommendations": {
      const first = event.recommendations[0] ?? null;
      return first
        ? {
            eyebrow: "Diagnosis updated",
            title: `Priority: ${first.title}`,
            message: `The engine found ${count(event.recommendations.length, "option")}, but only one should guide your next step. Open the priority to review the evidence, cost and risk.`,
            question: `Why should ${first.title} be my next step, and what do I need to check first?`,
          }
        : {
            eyebrow: "Diagnosis updated",
            title: "No actionable upgrade came up",
            message: "I won't make up a task. Review the unknown details or change the goal before trying again.",
            question: "What should I improve first to get a useful recommendation?",
          };
    }
    case "market":
      return {
        eyebrow: event.degraded ? "Market data degraded" : "Lookup finished",
        title: `${event.verifiedCount} of ${count(event.quoteCount, "price")} verified`,
        message: event.degraded
          ? "Some of this is cached or example data. Use it as a rough guide, never to justify a purchase you can't undo."
          : "Verified prices can now narrow the decision, but you still need to check the item fits your character.",
        question: "With these prices, what should I improve first within my budget?",
      };
    case "tracked":
      return {
        eyebrow: "Memory updated",
        title: `You saved “${event.title}”`,
        message:
          "The mentor will treat it as your one active action and won't suggest parallel tasks until you record the result.",
        question: `Why should ${event.title} stay my priority while I watch the result?`,
      };
    case "session":
      return {
        eyebrow: "Guided session started",
        title: event.title,
        message:
          "Before changing anything, decide what you expect to improve and what sign would make you stop. The result will go in your journal.",
        question: `Why is ${event.title} the decision I should check now?`,
      };
    case "profileSaved":
      return {
        eyebrow: "Character updated",
        title: "The changes are now part of the diagnosis",
        message:
          "Earlier recommendations and answers may be out of date. Generate a new diagnosis before spending anything.",
        question: "I've saved my character. What should I improve first now?",
      };
    case "planImported":
      return {
        eyebrow: "Reference plan imported",
        title: event.name,
        message:
          "This shows where the build is heading, but it doesn't describe your current character. The engine will keep the two apart.",
        question: `I've imported the plan ${event.name}. What should I improve first to get closer without mixing it up with my character?`,
      };
    case "applied":
      return {
        eyebrow: "Change marked",
        title: `You marked “${event.title}” as applied`,
        message:
          "This describes what you plan to export; it doesn't prove the result worked in the game. Record what you see afterwards.",
        question: `Why should I check the result of ${event.title} before continuing?`,
      };
    case "invalidated":
      return {
        eyebrow: "Diagnosis out of date",
        title: "Your data changed",
        message:
          "I've removed the earlier priorities because they no longer match your current character, goal or budget.",
        question: "My data changed. What should I improve first now?",
      };
    case "sessionResult":
      return {
        eyebrow: "Result recorded",
        title: event.title,
        message:
          "The result is now in your journal. The next diagnosis should start from what you saw, not from the earlier guess.",
        question: "I've recorded the result of my decision. What should I improve first now?",
      };
    case "sessionPaused":
      return {
        eyebrow: "Decision on hold",
        title: event.title,
        message:
          "I won't treat this decision as a failure, and I won't open another one without looking at why it stopped.",
        question: `Why should I review ${event.title} before choosing another upgrade?`,
      };
    case "error":
      return {
        eyebrow: "Couldn't update the context",
        title: `Problem with ${AREA_EN[event.area] ?? event.area}`,
        message: event.message,
      };
  }
}

export function englishMentorCue(event: ContextualMentorEvent): ContextualMentorCue {
  const spanish = contextualMentorCue(event);
  const copy = englishCopy(event);
  return {
    ...spanish,
    eyebrow: copy.eyebrow,
    title: copy.title,
    message: copy.message,
    ask: spanish.ask === null ? null : { ...spanish.ask, question: copy.question ?? spanish.ask.question },
  };
}
