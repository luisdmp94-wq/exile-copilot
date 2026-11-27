import type { ActGuide } from "./guide";
import { ACT_TWO_GUIDE } from "./actTwo";

/**
 * Act 2 survival guide in English. Same facts, route, rewards and sources as
 * `actTwo.ts`: only the language changes. Zone, boss and quest names are the
 * official English ones from poe2db.tw/us (checked on 17-11-2026). If a fact
 * changes, change it in BOTH files.
 */
export const ACT_TWO_GUIDE_EN: ActGuide = {
  ...ACT_TWO_GUIDE,
  actLabel: "act 2",
  title: "Act 2: how to cross the desert without dying",
  description:
    "Path of Exile 2 act 2 guide for new players: Rudja and Jamanra, fire and lightning resistance, and rewards you shouldn't skip.",
  summary: "Just enough to reach act 3 alive. If you're short on time, read only the box below.",
  check: {
    elemental: 30,
    nextAct: "act 3",
    focus: {
      element: "lightning",
      minimum: 30,
      note: "Jamanra, the Abomination, the final boss, hits with lightning: it's the one that matters most before you go in.",
    },
  },
  essentials: [
    {
      text: "Rudja, the Dread Engineer (Mawdun Mine), is the first wall: raise your fire resistance and get out of the tar before she lights it.",
      sourceIds: ["wiki-rudja", "maxroll-subida"],
    },
    {
      text: "The final boss, Jamanra, the Abomination, hits with lightning. In the sandstorm, stay behind Sekhema Asala's shield.",
      sourceIds: ["wiki-jamanra", "maxroll-jefes"],
    },
    {
      text: "Fire and lightning are the resistances that matter here. When you reach act 3 the penalty goes up to −20%.",
      sourceIds: ["wiki-resistencias"],
    },
    {
      text: "Don't skip the Sisters of Garukhan (+10% lightning for good) or Ancient Vows (+1 charm slot).",
      sourceIds: ["maxroll-subida", "wiki-promesas"],
    },
  ],
  route: [
    {
      zone: "Vastiri Outskirts",
      gems: ["Skill lvl 5: when you beat Rathbreaker, from Zarka"],
      text: "Beat Rathbreaker to board The Ardura Caravan.",
      priority: "historia",
      sourceIds: ["poe2db-acto2"],
    },
    {
      zone: "Mawdun Quarry and Mawdun Mine",
      text: "Rudja, the Dread Engineer, waits in the mine. Get out of the tar before she lights it.",
      priority: "historia",
      sourceIds: ["wiki-rudja", "poe2db-acto2"],
    },
    {
      zone: "Traitor's Passage",
      text: "Balbala, the Traitor. Beating her gives you Balbala's Barya, which opens the Trial of the Sekhemas.",
      priority: "historia",
      sourceIds: ["wiki-balbala", "poe2db-acto2"],
    },
    {
      zone: "Trial of the Sekhemas",
      text: "This is where you get your ascendancy. If it's too hard, come back with more levels: it doesn't expire.",
      optional: true,
      priority: "clave",
      reward: "your ascendancy",
      proof: { kind: "manual", question: "Have you already chosen an ascendancy?" },
      sourceIds: ["maxroll-subida", "poe2db-acto2"],
    },
    {
      zone: "The Halani Gates",
      gems: ["Skill lvl 7: after Jamanra, from Zarka", "Skill lvl 6: L'im the Impaler, the zone's optional boss"],
      text: "Jamanra, the Risen King, doesn't die: he flees. Then three routes open across the desert, and you have to do all three.",
      priority: "historia",
      sourceIds: ["wiki-acto2", "poe2db-acto2"],
    },
    {
      zone: "Keth",
      text: "Kabala, Constrictor Queen, drops a book with 2 weapon set passive points. Take her clan's relic too.",
      priority: "clave",
      reward: "2 passive points",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["wiki-libro", "wiki-promesas", "poe2db-acto2"],
    },
    {
      zone: "The Lost City and Buried Shrines",
      gems: ["Support: when you finish this route, from Zarka"],
      text: "Azarian, the Forsaken Son, waits at the end of the shrines.",
      priority: "historia",
      sourceIds: ["wiki-azarian", "poe2db-acto2"],
    },
    {
      zone: "Mastodon Badlands and The Bone Pits",
      gems: ["Support: when you finish this route, from Zarka"],
      text: "Ekbab, Ancient Steed. The sun clan relic is on this route: don't leave without it.",
      priority: "historia",
      sourceIds: ["wiki-promesas", "poe2db-acto2"],
    },
    {
      zone: "Valley of the Titans",
      text: "Ancient Vows: put both relics in the medallion and you get one more charm slot.",
      priority: "clave",
      reward: "+1 charm slot",
      proof: { kind: "manual", question: "Did you put both relics in the medallion in the Valley of the Titans?" },
      sourceIds: ["wiki-promesas", "poe2db-acto2"],
    },
    {
      zone: "The Titan Grotto",
      gems: ["Support: when you finish this route, from Zarka"],
      text: "Zalmarath, the Colossus, closes the valley route.",
      priority: "historia",
      sourceIds: ["poe2db-acto2"],
    },
    {
      zone: "Deshar",
      text: "The Abandoned Rhoa: find the Final Letter and bring it to Shambrin. Gives another book with 2 points.",
      priority: "clave",
      reward: "2 passive points",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["wiki-tradicion", "poe2db-acto2"],
    },
    {
      zone: "The Spires of Deshar",
      text: "Shrine of the Sisters of Garukhan: +10% lightning resistance for good. Then Tor Gul, the Defiler.",
      priority: "clave",
      reward: "+10% lightning resistance",
      proof: { kind: "resistance", element: "lightning", amount: 10 },
      sourceIds: ["maxroll-subida", "wiki-resistencias", "poe2db-acto2"],
    },
    {
      zone: "The Dreadnought",
      text: "Jamanra, the Abomination, the final boss. In the sandstorm, stay behind Sekhema Asala's shield.",
      priority: "historia",
      sourceIds: ["wiki-jamanra", "maxroll-jefes"],
    },
  ],
  blocks: [
    {
      id: "jefes",
      title: "Rudja and Jamanra",
      intro: "Rudja, in Mawdun Mine. Jamanra, the Abomination, at the end, in The Dreadnought.",
      cards: [
        {
          title: "Rudja",
          text: "She throws tar that slows you and then lights it with her flamethrower. Get out of the tar right away.",
          otherBoss: true,
        },
        {
          title: "Jamanra · phase 1",
          text: "Lightning bolts and electric pillars. In the sandstorm, stay inside Asala's shield.",
        },
        {
          title: "Jamanra · from 66%",
          text: "Tornadoes, spears and lightning orbs. Don't stand still.",
        },
      ],
      tips: [],
      more: [
        {
          lead: "Before Rudja:",
          text: "fire as high as you can. According to Maxroll, one or two Lesser Desert Runes make the difference.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Rudja also has a charge that can't be blocked and a poison gas that explodes if her fire touches it.",
          sourceIds: ["wiki-rudja"],
        },
        {
          text: "Leaving the safe zone during the sandstorm kills you very fast. Kill the minions that show up.",
          finalBoss: true,
          sourceIds: ["wiki-jamanra", "maxroll-jefes"],
        },
        {
          text: "Patch 0.5.2 lowered Jamanra, the Abomination's life by about 17%. Since 0.5.0 he's in The Dreadnought: if an old guide mentions a “vanguard”, it no longer exists.",
          finalBoss: true,
          sourceIds: ["ggg-052", "ggg-050"],
        },
        {
          lead: "Azarian, the Forsaken Son (Buried Shrines):",
          text: "he hits with fire and leaves the ground burning. At the Elemental Offering, if you're short on fire, pick fire: it gives a Ruby Ring.",
          sourceIds: ["wiki-azarian", "maxroll-subida"],
        },
        {
          lead: "Balbala, the Traitor (Traitor's Passage, optional):",
          text: "she turns invisible and releases poison gas. Your effects on her stay visible and give her away. You only need her for the ascendancy.",
          sourceIds: ["wiki-balbala"],
        },
      ],
    },
    {
      id: "resistencias",
      title: "Resistances",
      intro: "What hits with what:",
      cards: [
        { title: "Fire", text: "Rudja, Azarian, Balbala and Tor Gul." },
        { title: "Lightning", text: "Jamanra, the Abomination (final boss)." },
      ],
      tips: [
        {
          lead: "Aim for 30% in all three before act 3.",
          text: "It's a community reference, not an official number.",
          sourceIds: ["maxroll-subida"],
        },
      ],
      more: [
        {
          text: "The Lesser Desert Rune gives fire resistance (+10%, +14% or +18% depending on its level) when socketed in armour.",
          sourceIds: ["ggg-050"],
        },
        {
          text: "The cap is still 75%.",
          sourceIds: ["wiki-resistencias"],
        },
      ],
    },
    {
      id: "mejoras",
      title: "Rewards and cheap upgrades",
      intro: "All of them are optional and easy to miss.",
      tips: [
        {
          lead: "Ancient Vows:",
          text: "bring the relics from Kabala's clan and the sun clan to the medallion in the Valley of the Titans. You get one more charm slot.",
          sourceIds: ["wiki-promesas"],
        },
        {
          lead: "Sisters of Garukhan:",
          text: "their shrine is in The Spires of Deshar, before the final boss.",
          sourceIds: ["wiki-resistencias", "maxroll-subida"],
        },
      ],
      more: [
        {
          text: "Around level 30, vendors can have boots with 20% movement speed, colossal flasks and spirit amulets.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Ancient Vows also gives, your choice, +30% charm charges or +30% charm effect duration. You can change the choice later.",
          sourceIds: ["wiki-promesas"],
        },
        {
          lead: "Kabala, Constrictor Queen (Keth):",
          text: "drops a Book of Specialisation (2 weapon set passive points).",
          sourceIds: ["wiki-libro"],
        },
        {
          lead: "The Abandoned Rhoa (Deshar):",
          text: "find the Final Letter at the foot of the spires and bring it to Shambrin. Gives another Book of Specialisation.",
          sourceIds: ["wiki-tradicion"],
        },
      ],
    },
    {
      id: "trampas",
      title: "Act traps",
      intro: "What catches new players most.",
      tips: [
        {
          lead: "The three desert routes:",
          text: "the one you leave for last goes up in level. Don't save the one you find hardest for later.",
          sourceIds: ["wiki-acto2"],
        },
      ],
      more: [
        {
          text: "The three routes open after you face Jamanra, the Risen King (he doesn't die: he flees), and all three are required.",
          sourceIds: ["wiki-acto2"],
        },
        {
          lead: "The Trial of the Sekhemas (ascendancy):",
          text: "it's hard if your character is slow. You can come back later, with more levels.",
          sourceIds: ["maxroll-subida"],
        },
      ],
    },
  ],
  sources: ACT_TWO_GUIDE.sources.map((source) => {
    if (source.id === "ggg-050") return { ...source, label: "Grinding Gear Games — patch 0.5.0 notes (22-05-2026)" };
    if (source.id === "ggg-052") return { ...source, label: "Grinding Gear Games — patch 0.5.2 notes" };
    if (source.id === "maxroll-subida") {
      return { ...source, label: "Maxroll — Comprehensive League Start Leveling Guide (updated for 0.5.5)" };
    }
    if (source.id === "maxroll-jefes") return { ...source, label: "Maxroll — Act 2 Boss Guide (from 0.2: tactics, not numbers)" };
    if (source.id === "poe2db-acto2") {
      return { ...source, label: "PoE2DB — Act 2 (zones, bosses and rewards)", url: "https://poe2db.tw/us/Act_2" };
    }
    return source;
  }),
};
