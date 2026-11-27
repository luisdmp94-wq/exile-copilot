import type { ActGuide } from "./guide";
import { ACT_ONE_GUIDE } from "./actOne";

/**
 * Act 1 survival guide in English. Same facts, route, rewards and sources as
 * `actOne.ts`: only the language changes. Zone, boss and quest names are the
 * official English ones from poe2db.tw/us (checked on 17-11-2026). If a fact
 * changes, change it in BOTH files.
 */
export const ACT_ONE_GUIDE_EN: ActGuide = {
  ...ACT_ONE_GUIDE,
  actLabel: "act 1",
  title: "Act 1: how not to die before act 2",
  description:
    "Path of Exile 2 act 1 guide for new players: how to beat Count Geonor, which resistances to bring and cheap upgrades.",
  summary: "Just enough to reach act 2 alive. If you're short on time, read only the box below.",
  check: {
    elemental: 30,
    nextAct: "act 2",
    focus: {
      element: "cold",
      minimum: 30,
      note: "Count Geonor hits with cold: it's the one that matters most before you go in.",
    },
  },
  essentials: [
    {
      text: "The final boss, Count Geonor, is the wall people mention most: go in with at least 30% cold resistance.",
      sourceIds: ["maxroll-subida"],
    },
    {
      text: "When you reach act 2 you lose 10% fire, cold and lightning resistance.",
      sourceIds: ["wiki-resistencias"],
    },
    {
      text: "When upgrading gear, look for movement speed first and resistances second.",
      sourceIds: ["maxroll-subida"],
    },
    {
      text: "Don't skip the permanent rewards: weapon set passive points, life and spirit.",
      sourceIds: ["maxroll-subida"],
    },
  ],
  route: [
    {
      zone: "The Riverbank",
      gems: ["Skill lvl 1: The Bloated Miller"],
      text: "Kill The Bloated Miller: he gives you your first skill gem.",
      priority: "historia",
      sourceIds: ["poe2db-acto1"],
    },
    {
      zone: "Clearfell",
      gems: ["Skill lvl 1: an abandoned stash, on the side opposite the Mud Burrow entrance"],
      text: "Find Beira of the Rotten Pack: +10% cold resistance for good.",
      priority: "clave",
      reward: "+10% cold resistance",
      proof: { kind: "resistance", element: "cold", amount: 10 },
      sourceIds: ["wiki-resistencias", "poe2db-acto1"],
    },
    {
      zone: "Mud Burrow",
      gems: ["Support lvl 1: The Devourer"],
      text: "The Devourer gives a support gem and 100 gold.",
      optional: true,
      priority: "recomendable",
      sourceIds: ["poe2db-acto1"],
    },
    {
      zone: "The Grelwood",
      gems: ["Support lvl 1: Areagne, Forgotten Witch (optional; she attacks as you leave the Witch Hut)", "Skill lvl 2: The Brambleghast (optional)"],
      text: "Free medium flasks at the Witch Hut.",
      priority: "historia",
      skip: "The Brambleghast",
      sourceIds: ["maxroll-subida", "poe2db-acto1", "wiki-bosque"],
    },
    {
      zone: "The Red Vale",
      text: "Boss: The Rust King. The quest “Finding the Forge” lets you salvage items with Renly.",
      priority: "historia",
      sourceIds: ["poe2db-acto1"],
    },
    {
      zone: "The Grim Tangle",
      text: "It's the way to the cemetery.",
      priority: "historia",
      skip: "Ervig, the Rotten Druid",
      sourceIds: ["poe2db-acto1"],
    },
    {
      zone: "Cemetery of the Eternals",
      gems: ["Support: when you finish Lachlann's quest"],
      text: "To reach Lachlann of Endless Lament, go through the Mausoleum of the Praetor and the Tomb of the Consort first. Gives a support gem.",
      priority: "historia",
      sourceIds: ["wiki-acto1", "poe2db-acto1"],
    },
    {
      zone: "Hunting Grounds",
      text: "The Crowbell gives a book with 2 weapon set passive points.",
      priority: "clave",
      reward: "2 passive points",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["wiki-cuervo", "poe2db-acto1"],
    },
    {
      zone: "Freythorn",
      gems: ["Spirit lvl 4: The King in the Mists"],
      text: "The King in the Mists gives +30 spirit for good.",
      optional: true,
      priority: "clave",
      reward: "+30 spirit",
      proof: { kind: "spirit", amount: 30 },
      sourceIds: ["maxroll-subida", "wiki-rey-nieblas"],
    },
    {
      zone: "Ogham Farmlands",
      text: "Quest “The Lost Lute”: it's at Una's Hut. Gives another book with 2 points.",
      priority: "clave",
      reward: "2 passive points",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["poe2db-acto1", "wiki-libro"],
    },
    {
      zone: "Ogham Village",
      gems: ["Skill lvl 5: after The Executioner, back in town"],
      text: "The Executioner: get away from the gust of wind that marks his guillotine. Gives a level 5 skill gem.",
      priority: "historia",
      sourceIds: ["wiki-verdugo", "poe2db-acto1"],
    },
    {
      zone: "Ogham Manor",
      gems: ["Support: when you beat Count Geonor"],
      text: "Candlemass, the Living Rite, gives +20 life. Count Geonor waits at the end.",
      priority: "clave",
      reward: "+20 life",
      proof: { kind: "manual", question: "Did you kill Candlemass, the Living Rite, in Ogham Manor?" },
      sourceIds: ["maxroll-subida", "wiki-geonor"],
    },
  ],
  blocks: [
    {
      id: "jefes",
      title: "Count Geonor",
      intro: "Final boss of the act, in Ogham Manor. He hits with physical and cold damage.",
      cards: [
        { title: "Phase 1", text: "Don't stand behind him. Roll out of the ice walls." },
        { title: "From 75%", text: "He turns into a wolf. Don't step on the rune circle: it freezes." },
        { title: "From 50%", text: "He heals to full. Keep moving and, in the mist, just dodge." },
      ],
      tips: [
        {
          lead: "Before going in:",
          text: "30–40% cold resistance.",
          finalBoss: true,
          sourceIds: ["wiki-geonor", "maxroll-subida"],
        },
      ],
      more: [
        {
          lead: "Phase 1, hit by hit:",
          text: "his frost thrust (red flash) freezes a lot. If his charge misses, a huge slash behind him follows. With the two ice walls in a V, hit him through the middle.",
          finalBoss: true,
          sourceIds: ["wiki-geonor"],
        },
        {
          lead: "Wolf phase:",
          text: "he plants his sword surrounded by frost runes and summons werewolves: kill them or move away. At 50% he heals to full; his blood strike can't be blocked. Leave the ice patches before the spikes come out. From 25%, moonbeams fall until the end. In the mist he takes no damage and comes out charging six times.",
          finalBoss: true,
          sourceIds: ["wiki-geonor"],
        },
        {
          text: "Patch 0.5.3 lowered the damage of his moonbeams and backward slashes.",
          finalBoss: true,
          sourceIds: ["ggg-053"],
        },
        {
          lead: "The Executioner (Ogham Village):",
          text: "a gust of wind marks where his guillotine will fall; get out of the way. His fissure travels in a straight line: step sideways. Kill the minions so they don't surround you.",
          sourceIds: ["wiki-verdugo"],
        },
        {
          lead: "The King in the Mists (Freythorn, optional):",
          text: "one effect stuns you if you stand still and the other if you move: check which one you have. Kill his totems fast. Gives +30 spirit for good.",
          sourceIds: ["wiki-rey-nieblas", "maxroll-subida"],
        },
      ],
    },
    {
      id: "resistencias",
      title: "Resistances",
      intro: "In act 1 you lose nothing. From act 2 on, each act takes away more:",
      cards: [
        { title: "Act 2", text: "−10%" },
        { title: "Act 3", text: "−20%" },
        { title: "Act 4", text: "−30%" },
        { title: "Interludes", text: "−40% to −50%" },
        { title: "Maps", text: "−60%" },
      ],
      tips: [
        {
          lead: "Aim for 30% in all three.",
          text: "It's the reference used by community guides, not an official number.",
          sourceIds: ["wiki-resistencias", "maxroll-subida"],
        },
      ],
      more: [
        {
          text: "The normal cap is 75%: above that it's wasted, unless something raises your maximum.",
          sourceIds: ["wiki-resistencias"],
        },
        {
          text: "Beira of the Rotten Pack (Clearfell) drops a trophy that gives +10% cold resistance for good.",
          sourceIds: ["wiki-resistencias"],
        },
        {
          text: "Maxroll recommends having a Sapphire Ring (cold) around level 15, before Geonor.",
          sourceIds: ["maxroll-subida"],
        },
      ],
    },
    {
      id: "mejoras",
      title: "Cheap upgrades",
      intro: "Movement speed first, then resistances. It's a rule of thumb, not a fixed rule.",
      tips: [
        {
          text: "Check the vendor every time you go back to town.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Use Orbs of Transmutation on boots without fear: you're looking for speed.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Always pick up: The Crowbell and Una's lute (2 weapon set passive points each), Candlemass (+20 life) and The King in the Mists (+30 spirit).",
          sourceIds: ["maxroll-subida", "wiki-cuervo", "wiki-libro"],
        },
      ],
      more: [
        {
          text: "In act 1, vendors go up to item level 15.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "An Orb of Augmentation adds a modifier to a magic item that has only one. Save Regal Orbs for your best items.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "A white weapon with good base damage is worth it: transmute it and augment it.",
          sourceIds: ["wiki-consejos"],
        },
        {
          text: "Flasks: the cauldron at the Witch Hut, in The Grelwood, gives free medium flasks. Una sells greater flasks for 80–500 gold.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Socket resistance runes into your gear to cover whichever one you're missing.",
          sourceIds: ["maxroll-subida"],
        },
      ],
    },
  ],
  sources: ACT_ONE_GUIDE.sources.map((source) =>
    source.id === "ggg-053"
      ? { ...source, label: "Grinding Gear Games — patch 0.5.3 notes" }
      : source.id === "maxroll-subida"
        ? { ...source, label: "Maxroll — Comprehensive League Start Leveling Guide (updated for 0.5.5)" }
        : source.id === "poe2db-acto1"
          ? { ...source, label: "PoE2DB — Act 1 (boss and zone names)", url: "https://poe2db.tw/us/Act_1" }
          : source,
  ),
};
