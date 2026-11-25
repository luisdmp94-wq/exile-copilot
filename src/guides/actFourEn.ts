import type { ActGuide } from "./guide";
import { ACT_FOUR_GUIDE } from "./actFour";

/**
 * Act 4 survival guide in English. Same facts, route, rewards and sources as
 * `actFour.ts`: only the language changes. Zone, boss and item names are the
 * official English ones from poe2db.tw/us (checked on 21-11-2026). If a fact
 * changes, change it in BOTH files.
 */
export const ACT_FOUR_GUIDE_EN: ActGuide = {
  ...ACT_FOUR_GUIDE,
  actLabel: "act 4",
  title: "Act 4: the islands without missing anything",
  description:
    "Path of Exile 2 act 4 guide for new players: the resistance tattoos, the weapon set points, Tavakai and how to reach the Interludes alive.",
  summary: "Just enough to cross the islands without leaving anything behind. If you're short on time, read only the box below.",
  check: {
    elemental: 30,
    nextAct: "the Interludes",
  },
  essentials: [
    {
      text: "The game sends you to Kedge Bay and Journey's End first. After that, do the islands in any order and leave Arastas and Ngakanu for last.",
      sourceIds: ["poe2db-acto4", "maxroll-subida"],
    },
    {
      text: "In the Halls of the Dead pick the three resistance tattoos (+5% each), not the attribute ones: you can't change it.",
      sourceIds: ["wiki-salones", "wiki-resistencias"],
    },
    {
      text: "There are 4 weapon set passive points: the Mist-shrouded Tome (after beating Omniphobia) and the Tattoo of Hinekora (Trial of the Ancestors).",
      sourceIds: ["wiki-nieblas", "wiki-ancestros", "maxroll-subida"],
    },
    {
      text: "Tavakai, the final boss, hits with fire, cold and lightning. In the Interludes the penalty goes up to −40%: raise all three before you leave.",
      sourceIds: ["wiki-tavakai", "maxroll-jefes", "wiki-resistencias"],
    },
  ],
  route: [
    {
      zone: "Kingsmarch",
      text: "The act's town. From here you sail to the islands: Kedge Bay first, then the rest in any order.",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "wiki-acto4"],
    },
    {
      zone: "Kedge Bay and Journey's End",
      text: "Your first trip: the game sends you here before any other island. Captain Hartlin waits in Journey's End. Open the chest in the bay: it holds a Torn Map Piece (1 of 4).",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "maxroll-jefes"],
    },
    {
      zone: "Isle of Kin and Volcanic Warrens",
      text: "Krutog, Lord of Kin, hits with lightning. The Blind Beast is optional: it drops a rune Dannig swaps for another. The Magma Twins (two rock golems that come as a pair, in the Warrens) are optional too: no set reward. On the shore, a sailor's body drops a Torn Map Piece (2 of 4).",
      priority: "historia",
      skip: "The Blind Beast and the Magma Twins",
      sourceIds: ["poe2db-acto4", "maxroll-jefes", "wiki-acto4"],
    },
    {
      zone: "Journey's End",
      gems: ["Skill lv. 13: after beating Omniphobia and talking to Tujen"],
      text: "Optional quest: go back to Dannig, then fight Omniphobia, Fear Manifest. Tujen gives you the Mist-shrouded Tome: 2 weapon set passive points.",
      optional: true,
      priority: "clave",
      reward: "2 passive points",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["wiki-nieblas", "maxroll-subida"],
    },
    {
      zone: "Abandoned Prison and Solitary Confinement",
      text: "The Prisoner heals at 50%, 25% and 10% life: shoot him with the ballista to stop it. In the chapel, the Goddess of Justice lets you pick +30% flask life or mana recovery (you can change it).",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "wiki-prision", "maxroll-jefes"],
    },
    {
      zone: "Whakapanu Island and Singing Caverns",
      text: "Diamora, Song of Death: while she sings, don't face her gaze (it petrifies). Then talk to Ange: it unlocks the currency exchange and your hideout. This island has another Torn Map Piece (3 of 4).",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "maxroll-jefes", "maxroll-subida"],
    },
    {
      zone: "Whakapanu Island",
      text: "The Great White One is an optional boss. Bring its Shark Fin to Kaimana and pick a permanent buff: Kaom's Lesson (+30% armour, evasion and energy shield) or Rakiata's Lesson.",
      optional: true,
      priority: "clave",
      reward: "defence buff",
      proof: { kind: "manual", question: "Did you bring the Shark Fin to Kaimana and pick your lesson?" },
      sourceIds: ["wiki-medicina", "poe2db-acto4"],
    },
    {
      zone: "Eye of Hinekora",
      gems: ["Spirit lv. 12: chest behind the waterfall, between two of the tests"],
      text: "Opens when you rescue Matiki. Do its three tests and pay your respects to Navali: +5% maximum mana for good and a Greater Mind Rune.",
      optional: true,
      priority: "clave",
      reward: "+5% mana",
      proof: { kind: "manual", question: "Did you do the Eye of Hinekora tests and talk to Navali?" },
      sourceIds: ["wiki-hinekora", "poe2db-acto4", "ggg-050"],
    },
    {
      zone: "Halls of the Dead",
      text: "Three optional tests, each with a tattoo to choose. Take the resistance ones: +5% fire, +5% cold and +5% lightning. At the end, Yama the White hits with chaos.",
      optional: true,
      priority: "clave",
      reward: "+5% to all 3 resistances",
      proof: { kind: "manual", question: "Did you pick the three resistance tattoos in the Halls of the Dead?" },
      sourceIds: ["wiki-salones", "wiki-resistencias", "maxroll-jefes"],
    },
    {
      zone: "Trial of the Ancestors",
      text: "After Yama. Talk to Navali at the very top and she gives you the Tattoo of Hinekora: 2 weapon set passive points.",
      optional: true,
      priority: "clave",
      reward: "2 passive points",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["wiki-ancestros", "maxroll-subida"],
    },
    {
      zone: "Shrike Island",
      text: "Scourge of the Skies: stay in front of it and roll to dodge its blood mortars. The last Torn Map Piece is here (4 of 4).",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "maxroll-jefes"],
    },
    {
      zone: "Plunder's Point",
      text: "Optional Expedition island (level 53). It only opens once you have all four Torn Map Pieces: Kedge Bay, Isle of Kin, Whakapanu Island and Shrike Island.",
      optional: true,
      priority: "recomendable",
      sourceIds: ["poe2db-acto4", "wiki-acto4"],
    },
    {
      zone: "Arastas",
      text: "Torvian, Hand of the Saviour. Ring the Golden Bells: they give Regal and Exalted Orbs.",
      priority: "recomendable",
      sourceIds: ["poe2db-acto4", "maxroll-subida", "maxroll-jefes"],
    },
    {
      zone: "The Excavation",
      text: "Benedictus, First Herald of Utopia. Look for the safe gap in the explosion rings.",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "maxroll-jefes"],
    },
    {
      zone: "Ngakanu and Heart of the Tribe",
      text: "Tavakai, the Chieftain, the final boss.",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "wiki-tavakai"],
    },
  ],
  blocks: [
    {
      id: "jefes",
      title: "Tavakai and other hard bosses",
      intro: "Tavakai, the Chieftain, at the end, in the Heart of the Tribe. He has three phases.",
      cards: [
        {
          title: "Tavakai · at the start",
          text: "He throws a hook: roll to dodge it.",
        },
        {
          title: "At 50% and 25%",
          text: "He changes phase and adds fire, cold and lightning. Keep moving.",
        },
        {
          title: "Kitava's mark",
          text: "He heals from the damage he deals to you. The less he hits you, the sooner he falls.",
        },
      ],
      tips: [],
      more: [
        {
          lead: "The Prisoner (Solitary Confinement):",
          text: "heals at 50%, 25% and 10% life. Each time, shoot him with the ballista to stop it.",
          sourceIds: ["maxroll-jefes", "poe2db-acto4"],
        },
        {
          lead: "Yama the White:",
          text: "hits with chaos. Use the pillars as cover and find the real Yama among his clones. Maxroll advises boots with movement speed.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          lead: "Diamora, Song of Death:",
          text: "dodge her waves. When she sings, her gaze petrifies: don't face her.",
          sourceIds: ["maxroll-jefes", "poevault-jefes"],
        },
        {
          lead: "Torvian, Hand of the Saviour:",
          text: "interrupt the priests helping him. Don't cross his holy walls: they slow you and make you easier to crit.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          lead: "Captain Hartlin:",
          text: "leave the spectral anchor area and dodge the circles of his cannon barrage.",
          sourceIds: ["maxroll-jefes", "poevault-jefes"],
        },
      ],
    },
    {
      id: "resistencias",
      title: "Resistances",
      intro: "What hits with what:",
      cards: [
        { title: "Fire", text: "Torvian and Tavakai." },
        { title: "Cold", text: "Hartlin, Diamora, the Prisoner and Tavakai." },
        { title: "Lightning", text: "Krutog, the Blind Beast, Benedictus and Tavakai." },
        { title: "Chaos", text: "Yama the White." },
      ],
      tips: [
        {
          lead: "The three Halls of the Dead tattoos give +5% to each resistance, free.",
          text: "Aim for 30% in all three before the Interludes. Maxroll advises getting as close to 75% as you can.",
          sourceIds: ["wiki-salones", "maxroll-subida"],
        },
      ],
      more: [
        {
          text: "In act 4 the game takes away 30%. In the Interludes, 40%, and 50% in their areas of level 60 or more.",
          sourceIds: ["wiki-resistencias"],
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
      intro: "Almost all are in optional areas and easy to miss.",
      tips: [
        {
          lead: "Omniphobia:",
          text: "skip that quest and you lose 2 weapon set points and a level 13 skill gem.",
          sourceIds: ["wiki-nieblas"],
        },
        {
          lead: "Kaimana:",
          text: "Kaom's Lesson is the simple one: +30% to armour, evasion and energy shield.",
          sourceIds: ["wiki-medicina", "poe2db-acto4"],
        },
      ],
      more: [
        {
          text: "Rakiata's Lesson: 15% of your armour also applies to elemental damage, deflection equal to 12% of your evasion, and energy shield starts recharging 12% sooner.",
          sourceIds: ["wiki-medicina"],
        },
        {
          text: "Arastas and Ngakanu have shops (spells and blacksmith) you can visit before doing them.",
          sourceIds: ["poe2db-acto4"],
        },
      ],
    },
    {
      id: "trampas",
      title: "Act traps",
      intro: "What catches new players most.",
      tips: [
        {
          lead: "Tattoos can't be changed.",
          text: "If you pick +5 to an attribute instead of +5% resistance, it stays that way for good.",
          sourceIds: ["wiki-salones", "poe2db-acto4"],
        },
      ],
      more: [
        {
          text: "Where Matiki is changes from league to league. An old guide may send you to a different island.",
          sourceIds: ["wiki-acto4"],
        },
        {
          text: "The Goddess of Justice flask choice can be changed: go back to the statue.",
          sourceIds: ["wiki-prision"],
        },
        {
          text: "After act 4 come three Interludes before the maps. Each stretch takes away more resistance.",
          sourceIds: ["wiki-resistencias", "maxroll-subida"],
        },
      ],
    },
  ],
  sources: ACT_FOUR_GUIDE.sources.map((source) => {
    if (source.id === "poe2db-acto4") {
      return { ...source, label: "PoE2DB — Act 4 (zones, bosses and rewards)", url: "https://poe2db.tw/us/Act_4" };
    }
    if (source.id === "wiki-acto4") return { ...source, label: "PoE2 Wiki — Act 4 (free order, Matiki and Plunder's Point)" };
    if (source.id === "maxroll-subida") {
      return { ...source, label: "Maxroll — Comprehensive League Start Leveling Guide (updated for 0.5.5)" };
    }
    if (source.id === "maxroll-jefes") return { ...source, label: "Maxroll — Act 4 Boss Guide (from 0.3: tactics, not numbers)" };
    if (source.id === "poevault-jefes") return { ...source, label: "PoE-Vault — Act 4 Boss Guide (undated)" };
    if (source.id === "wiki-nieblas") return { ...source, label: "PoE2 Wiki — Dark Mists (Omniphobia and the Mist-shrouded Tome)" };
    if (source.id === "wiki-ancestros") return { ...source, label: "PoE2 Wiki — Trial of the Ancestors (quest)" };
    if (source.id === "wiki-salones") return { ...source, label: "PoE2 Wiki — Halls of the Dead (tattoos)" };
    if (source.id === "wiki-medicina") return { ...source, label: "PoE2 Wiki — Tribal Medicine (Kaimana)" };
    if (source.id === "ggg-050") return { ...source, label: "Grinding Gear Games — patch 0.5.0 notes (22-05-2026)" };
    return source;
  }),
};
