import type { ActGuide } from "./guide";
import { ACT_THREE_GUIDE } from "./actThree";

/**
 * Act 3 survival guide in English. Same facts, route, rewards and sources as
 * `actThree.ts`: only the language changes. Zone, boss and quest names are the
 * official English ones from poe2db.tw/us (checked on 17-11-2026). If a fact
 * changes, change it in BOTH files.
 */
export const ACT_THREE_GUIDE_EN: ActGuide = {
  ...ACT_THREE_GUIDE,
  actLabel: "act 3",
  title: "Act 3: how to get out of the Vaal jungle alive",
  description:
    "Path of Exile 2 act 3 guide for new players: Doryani, resistances for act 4 and the permanent rewards you shouldn't skip.",
  summary: "Just enough to reach act 4 alive. If you're short on time, read only the box below.",
  check: {
    elemental: 30,
    nextAct: "act 4",
    focus: {
      element: "lightning",
      minimum: 30,
      note: "Doryani, the final boss, uses a lot of lightning (and fire too): raise it before you go in.",
    },
  },
  essentials: [
    {
      text: "Don't skip Blackjaw (+10% fire for good) or Ignagduk (+30 spirit for good).",
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      text: "There are 4 weapon set passive points: Mighty Silverfist and the Sacrificial Heart in Aggorat.",
      sourceIds: ["poe2db-acto3", "poe2db-corazon"],
    },
    {
      text: "The final boss, Doryani, Royal Thaumaturge, hits with lightning, fire and some cold. At half life he climbs into a mech: keep moving.",
      sourceIds: ["poe2db-doryani", "maxroll-jefes"],
    },
    {
      text: "When you reach act 4 the penalty goes up to −30%. Aim for 30% or more in all three before you leave.",
      sourceIds: ["wiki-resistencias", "maxroll-subida"],
    },
  ],
  route: [
    {
      zone: "Sandswept Marsh and Ziggurat Encampment",
      gems: ["Skill lvl 9: Rootdredge (optional)"],
      text: "You reach the act's town. Rootdredge is optional: he only drops a gem.",
      priority: "historia",
      skip: "Rootdredge",
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "Jungle Ruins",
      text: "Mighty Silverfist, among the stone ruins: 2 weapon set passive points.",
      priority: "clave",
      reward: "2 passive points",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "The Venom Crypts",
      text: "Off the Jungle Ruins. Bring the venom to Servi and pick a permanent buff: it can't be changed.",
      optional: true,
      priority: "clave",
      reward: "permanent buff",
      proof: { kind: "manual", question: "Did you pick Servi's buff in The Venom Crypts?" },
      sourceIds: ["poe2db-criptas", "maxroll-subida"],
    },
    {
      zone: "Infested Barrens and Chimeral Wetlands",
      text: "Xyclucian, the Chimera. After beating Xyclucian you can do the Trial of Chaos.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "Jiquani's Machinarium",
      text: "Blackjaw, the Remnant, is optional but gives +10% fire resistance for good.",
      priority: "clave",
      reward: "+10% fire resistance",
      proof: { kind: "resistance", element: "fire", amount: 10 },
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "Jiquani's Sanctum",
      text: "Zicoatl, Warden of the Core. Hits with lightning.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-jefes"],
    },
    {
      zone: "The Matlan Waterways",
      text: "The Azak Bog leads off from here. Take the waypoint: you'll have to come back.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "The Azak Bog",
      gems: ["Spirit lvl 10: Ignagduk, the Bog Witch"],
      text: "Optional area. Ignagduk, the Bog Witch, gives +30 spirit for good.",
      optional: true,
      priority: "clave",
      reward: "+30 spirit",
      proof: { kind: "spirit", amount: 30 },
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "Trial of Chaos",
      text: "In the Temple of Chaos. Gives ascendancy points 3 and 4. If it's too hard, come back with more levels.",
      optional: true,
      priority: "clave",
      reward: "2 ascendancy points",
      proof: { kind: "manual", question: "Have you done the Trial of Chaos yet (ascendancy points 3 and 4)?" },
      sourceIds: ["maxroll-subida", "poe2db-acto3"],
    },
    {
      zone: "The Drowned City",
      text: "Take its waypoints: The Molten Vault and the Apex of Filth both lead off from here.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "The Molten Vault",
      gems: ["Skill lvl 10: Mektul, the Forgemaster (optional)"],
      text: "Mektul, the Forgemaster, drops The Hammer of Kamasa: take it to Oswald in town and you unlock the Reforging Bench (three identical items for a new one). He also gives a level 10 Uncut Skill Gem. It's a race against the clock: if you lack damage, come back after the act.",
      optional: true,
      priority: "recomendable",
      skip: "Mektul, the Forgemaster",
      sourceIds: ["maxroll-subida", "maxroll-jefes"],
    },
    {
      zone: "Apex of Filth",
      text: "The Queen of Filth. Hits with chaos and fills the floor with exploding mushrooms.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-jefes"],
    },
    {
      zone: "Temple of Kopec",
      text: "Ketzuli, High Priest of the Sun. Hits with fire.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-jefes"],
    },
    {
      zone: "Utzaal (Past)",
      text: "You travel to the past. Viper Napuatzi waits at the end.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-jefes"],
    },
    {
      zone: "Aggorat (Past)",
      text: "Kill Vaal until the Sacrificial Heart drops and use it at the altar: 2 weapon set passive points.",
      priority: "clave",
      reward: "2 passive points",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["poe2db-corazon", "maxroll-subida"],
    },
    {
      zone: "The Black Chambers (Past)",
      text: "Doryani, Royal Thaumaturge, the final boss.",
      priority: "historia",
      sourceIds: ["poe2db-doryani", "maxroll-jefes"],
    },
  ],
  blocks: [
    {
      id: "jefes",
      title: "Doryani and other tough bosses",
      intro: "Doryani, Royal Thaumaturge, at the end, in The Black Chambers.",
      cards: [
        {
          title: "Doryani · on foot",
          text: "Lightning, a flamethrower and fireballs. Keep moving.",
        },
        {
          title: "Doryani · from 50%",
          text: "He climbs into a mech. Its fist chases you: run around the room and dodge roll when it slows down.",
        },
        {
          title: "Mech at 50%",
          text: "Doryani flies for a while with new attacks. Frost laser: roll past the boss when it turns from blue to red.",
        },
      ],
      tips: [],
      more: [
        {
          text: "Static blast: stand inside the circle and it does no damage. Spikes on the floor: don't step on them.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          lead: "Mighty Silverfist (Jungle Ruins):",
          text: "he rolls at you and stuns again and again. Dodge roll; with low armour it's deadly.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          lead: "Ignagduk, the Bog Witch:",
          text: "below 75% life she switches to fire spells. In the bone corridor, stand behind her or far from the exit.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          text: "If your fire is very low (under 30–40%), Maxroll suggests the optional Flameskin Ritual in the bog: it gives fire for a while.",
          sourceIds: ["maxroll-subida"],
        },
        {
          lead: "Mektul, the Forgemaster:",
          text: "you have under 4 minutes before molten gold covers the room. He's optional.",
          sourceIds: ["maxroll-jefes", "maxroll-subida"],
        },
        {
          lead: "Ketzuli, High Priest of the Sun:",
          text: "his light beam burns more the longer you stay in it. Run toward him and roll past him.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          lead: "Viper Napuatzi:",
          text: "her bite can't be blocked: dodge sideways. The arena shrinks, and in the end you get hit from both sides.",
          sourceIds: ["maxroll-jefes"],
        },
      ],
    },
    {
      id: "resistencias",
      title: "Resistances",
      intro: "What hits with what:",
      cards: [
        { title: "Fire", text: "Ignagduk, Blackjaw, Mektul, Ketzuli and Doryani." },
        { title: "Lightning", text: "Zicoatl, Xyclucian, Napuatzi and Doryani." },
        { title: "Chaos", text: "The Queen of Filth and Napuatzi." },
      ],
      tips: [
        {
          lead: "Aim for 30% in all three before act 4.",
          text: "It's a community reference. Maxroll advises getting as close to 75% as you can.",
          sourceIds: ["maxroll-subida"],
        },
      ],
      more: [
        {
          text: "In act 3 the game takes away 20%; in act 4, 30%.",
          sourceIds: ["wiki-resistencias"],
        },
        {
          text: "Around level 35, vendors can have Prismatic Rings, with resistance to all three.",
          sourceIds: ["maxroll-subida"],
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
          lead: "The Venom Crypts:",
          text: "Servi's buff can't be changed later. Choose calmly.",
          sourceIds: ["maxroll-subida", "poe2db-criptas"],
        },
        {
          lead: "Boots:",
          text: "switch to a pair with 20% movement speed as soon as you can. Check the vendors in the Ziggurat Encampment.",
          sourceIds: ["maxroll-subida"],
        },
      ],
      more: [
        {
          text: "The crypt buffs: 25% increased Stun Threshold, 30% increased Elemental Ailment Threshold or 25% increased Mana Regeneration Rate.",
          sourceIds: ["poe2db-criptas"],
        },
        {
          text: "Ignagduk also drops an Uncut Spirit Gem.",
          sourceIds: ["poe2db-acto3"],
        },
        {
          text: "Around level 40, in The Drowned City, start looking for better flasks.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "You can do the Trial of Chaos whenever you like after beating Xyclucian.",
          sourceIds: ["maxroll-subida"],
        },
      ],
    },
    {
      id: "trampas",
      title: "Act traps",
      intro: "What catches new players most.",
      tips: [
        {
          lead: "The Sacrificial Heart:",
          text: "gives nothing until you use it at the altar in Aggorat. It can also drop in Utzaal.",
          sourceIds: ["poe2db-corazon", "maxroll-subida"],
        },
      ],
      more: [
        {
          text: "Patch 0.5.0 changed the zone order of act 3: an old guide may give you a different route.",
          sourceIds: ["ggg-050"],
        },
        {
          text: "Mektul and The Molten Vault aren't needed for the story: if he's too hard, come back later.",
          sourceIds: ["maxroll-subida"],
        },
      ],
    },
  ],
  sources: ACT_THREE_GUIDE.sources.map((source) => {
    if (source.id === "ggg-050") return { ...source, label: "Grinding Gear Games — patch 0.5.0 notes (22-05-2026)" };
    if (source.id === "maxroll-subida") {
      return { ...source, label: "Maxroll — Comprehensive League Start Leveling Guide (updated for 0.5.5)" };
    }
    if (source.id === "maxroll-jefes") return { ...source, label: "Maxroll — Act 3 Boss Guide (from 0.2: tactics, not numbers)" };
    if (source.id === "poe2db-acto3") {
      return { ...source, label: "PoE2DB — Act 3 (zones, bosses and rewards)", url: "https://poe2db.tw/us/Act_3" };
    }
    if (source.id === "poe2db-criptas") {
      return { ...source, label: "PoE2DB — The Venom Crypts", url: "https://poe2db.tw/us/The_Venom_Crypts" };
    }
    if (source.id === "poe2db-corazon") {
      return { ...source, label: "PoE2DB — Sacrificial Heart", url: "https://poe2db.tw/us/Sacrificial_Heart" };
    }
    if (source.id === "poe2db-doryani") {
      return {
        ...source,
        label: "PoE2DB — Doryani, Royal Thaumaturge",
        url: "https://poe2db.tw/us/Doryani%2C_Royal_Thaumaturge",
      };
    }
    return source;
  }),
};
