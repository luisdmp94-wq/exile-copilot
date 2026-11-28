// GENERADO por scripts/refresh-emotion-data.mjs: no editar a mano.
// Texto de cada emoción líquida en el juego, tal como lo publica poe2db
// (https://poe2db.tw/us/Stackable_Currency y https://poe2db.tw/sp/Stackable_Currency).
import type { EmotionData } from "./craftingEmotions.js";

export const EMOTION_DATA_READ_AT = "2026-11-28";

export const EMOTION_DATA: EmotionData[] = [
  {
    id: "diluted-liquid-ire",
    name: {"es":"Ira líquida diluida","en":"Diluted Liquid Ire"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Armadura aumentada un (10—20)%","en":"(10—20)% increased Armour"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Escudo de energía máximo aumentado un (10—20)%","en":"(10—20)% increased maximum Energy Shield"}},
      {"jewel":"emerald","affix":"prefix","text":{"es":"Evasión aumentada un (10—20)%","en":"(10—20)% increased Evasion Rating"}},
    ],
  },
  {
    id: "diluted-liquid-guilt",
    name: {"es":"Culpa líquida diluida","en":"Diluted Liquid Guilt"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Daño de fuego aumentado un (5—15)%","en":"(5—15)% increased Fire Damage"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Daño de hielo aumentado un (5—15)%","en":"(5—15)% increased Cold Damage"}},
      {"jewel":"emerald","affix":"prefix","text":{"es":"Daño de rayo aumentado un (5—15)%","en":"(5—15)% increased Lightning Damage"}},
    ],
  },
  {
    id: "diluted-liquid-greed",
    name: {"es":"Codicia líquida diluida","en":"Diluted Liquid Greed"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Daño físico global aumentado un (5—15)%","en":"(5—15)% increased Global Physical Damage"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Daño de caos aumentado un (7—13)%","en":"(7—13)% increased Chaos Damage"}},
      {"jewel":"emerald","affix":"prefix","text":{"es":"Daño elemental aumentado un (5—15)%","en":"(5—15)% increased Elemental Damage"}},
    ],
  },
  {
    id: "liquid-paranoia",
    name: {"es":"Paranoia líquida","en":"Liquid Paranoia"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Daño de ataques aumentado un (5—15)%","en":"(5—15)% increased Attack Damage"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"Velocidad de lanzamiento de hechizos aumentada un (2—4)%","en":"(2—4)% increased Cast Speed"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Velocidad de ataque aumentada un (2—4)%","en":"(2—4)% increased Attack Speed"}},
    ],
  },
  {
    id: "liquid-envy",
    name: {"es":"Envidia líquida","en":"Liquid Envy"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"suffix","text":{"es":"El (4—6)% de los costos de maná de las habilidades se convierte en costos de vida","en":"(4—6)% of Skill Mana Costs Converted to Life Costs"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Daño de hechizos aumentado un (5—15)%","en":"(5—15)% increased Spell Damage"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Velocidad de recuperación del enfriamiento aumentada un (3—5)%","en":"(3—5)% increased Cooldown Recovery Rate"}},
    ],
  },
  {
    id: "liquid-disgust",
    name: {"es":"Disgusto líquido","en":"Liquid Disgust"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"suffix","text":{"es":"Velocidad de regeneración de vida aumentada un (5—10)%","en":"(5—10)% increased Life Regeneration rate"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"Recuperas un (1—2)% de maná al matar","en":"Recover (1—2)% of maximum Mana on Kill"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Recuperas un (1—2)% de vida al matar","en":"Recover (1—2)% of maximum Life on Kill"}},
    ],
  },
  {
    id: "liquid-despair",
    name: {"es":"Desesperación líquida","en":"Liquid Despair"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"suffix","text":{"es":"Ganas 1 de furia al impactar cuerpo a cuerpo","en":"Gain 1 Rage on Melee Hit"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"Probabilidad de impacto crítico de los hechizos aumentada un (5—15)%","en":"(5—15)% increased Critical Hit Chance for Spells"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Probabilidad de impacto crítico de los ataques aumentada un (6—16)%","en":"(6—16)% increased Critical Hit Chance for Attacks"}},
    ],
  },
  {
    id: "concentrated-liquid-fear",
    name: {"es":"Miedo líquido concentrado","en":"Concentrated Liquid Fear"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"suffix","text":{"es":"Velocidad de los gritos de guerra aumentada un (10—20)%","en":"(10—20)% increased Warcry Speed"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"Bonificación de daño crítico de los hechizos aumentada un (10—20)%","en":"(10—20)% increased Critical Spell Damage Bonus"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Bonificación de daño crítico del daño de los ataques aumentada un (10—20)%","en":"(10—20)% increased Critical Damage Bonus for Attack Damage"}},
    ],
  },
  {
    id: "concentrated-liquid-suffering",
    name: {"es":"Sufrimiento líquido concentrado","en":"Concentrated Liquid Suffering"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"+(1—2) al máximo de furia","en":"+(1—2) to Maximum Rage"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Área de efecto aumentada un (4—6)%","en":"(4—6)% increased Area of Effect"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Velocidad de movimiento aumentada un (1—2)%","en":"(1—2)% increased Movement Speed"}},
    ],
  },
  {
    id: "concentrated-liquid-isolation",
    name: {"es":"Aislamiento líquido concentrado","en":"Concentrated Liquid Isolation"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"suffix","text":{"es":"+1% a la resistencia al fuego máxima","en":"+1% to Maximum Fire Resistance"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"+1% a la resistencia al hielo máxima","en":"+1% to Maximum Cold Resistance"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"+1% a la resistencia al rayo máxima","en":"+1% to Maximum Lightning Resistance"}},
      {"jewel":"diamond","affix":"suffix","text":{"es":"+1% a la resistencia al caos máxima","en":"+1% to Maximum Chaos Resistance"}},
    ],
  },
  {
    id: "ancient-diluted-liquid-ire",
    name: {"es":"Ira líquida diluida antigua","en":"Ancient Diluted Liquid Ire"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Armadura aumentada un (2—3)%","en":"Small Passive Skills in Radius also grant (2—3)% increased Armour"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Escudo de energía máximo aumentado un (2—3)%","en":"Small Passive Skills in Radius also grant (2—3)% increased maximum Energy Shield"}},
      {"jewel":"emerald","affix":"prefix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Evasión aumentada un (2—3)%","en":"Small Passive Skills in Radius also grant (2—3)% increased Evasion Rating"}},
    ],
  },
  {
    id: "ancient-diluted-liquid-guilt",
    name: {"es":"Culpa líquida diluida antigua","en":"Ancient Diluted Liquid Guilt"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Daño de fuego aumentado un (1—2)%","en":"Small Passive Skills in Radius also grant (1—2)% increased Fire Damage"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Daño de hielo aumentado un (1—2)%","en":"Small Passive Skills in Radius also grant (1—2)% increased Cold Damage"}},
      {"jewel":"emerald","affix":"prefix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Daño de rayo aumentado un (1—2)%","en":"Small Passive Skills in Radius also grant (1—2)% increased Lightning Damage"}},
    ],
  },
  {
    id: "ancient-diluted-liquid-greed",
    name: {"es":"Codicia líquida diluida antigua","en":"Ancient Diluted Liquid Greed"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Daño físico global aumentado un (1—2)%","en":"Small Passive Skills in Radius also grant (1—2)% increased Global Physical Damage"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Daño de caos aumentado un (1—2)%","en":"Small Passive Skills in Radius also grant (1—2)% increased Chaos Damage"}},
      {"jewel":"emerald","affix":"prefix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Daño elemental aumentado un (1—2)%","en":"Small Passive Skills in Radius also grant (1—2)% increased Elemental Damage"}},
    ],
  },
  {
    id: "ancient-liquid-paranoia",
    name: {"es":"Paranoia líquida antigua","en":"Ancient Liquid Paranoia"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Daño de ataques aumentado un (1—2)%","en":"Small Passive Skills in Radius also grant (1—2)% increased Attack Damage"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Velocidad de lanzamiento de hechizos aumentada un (1—2)%","en":"Notable Passive Skills in Radius also grant (1—2)% increased Cast Speed"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Velocidad de ataque aumentada un (1—2)%","en":"Notable Passive Skills in Radius also grant (1—2)% increased Attack Speed"}},
    ],
  },
  {
    id: "ancient-liquid-envy",
    name: {"es":"Envidia líquida antigua","en":"Ancient Liquid Envy"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan El (2—3)% de los costos de maná de las habilidades se convierte en costos de vida","en":"Notable Passive Skills in Radius also grant (2—3)% of Skill Mana Costs Converted to Life Costs"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Daño de hechizos aumentado un (1—2)%","en":"Small Passive Skills in Radius also grant (1—2)% increased Spell Damage"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Velocidad de recuperación del enfriamiento aumentada un (1—3)%","en":"Notable Passive Skills in Radius also grant (1—3)% increased Cooldown Recovery Rate"}},
    ],
  },
  {
    id: "ancient-liquid-disgust",
    name: {"es":"Disgusto líquido antiguo","en":"Ancient Liquid Disgust"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Velocidad de regeneración de vida aumentada un (3—5)%","en":"Notable Passive Skills in Radius also grant (3—5)% increased Life Regeneration rate"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Recuperas un 1% de maná al matar","en":"Notable Passive Skills in Radius also grant Recover 1% of maximum Mana on Kill"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Recuperas un 1% de vida al matar","en":"Notable Passive Skills in Radius also grant Recover 1% of maximum Life on Kill"}},
    ],
  },
  {
    id: "ancient-liquid-despair",
    name: {"es":"Desesperación líquida antigua","en":"Ancient Liquid Despair"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Ganas 1 de furia al impactar cuerpo a cuerpo","en":"Notable Passive Skills in Radius also grant Gain 1 Rage on Melee Hit"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Probabilidad de impacto crítico de los hechizos aumentada un (3—7)%","en":"Notable Passive Skills in Radius also grant (3—7)% increased Critical Hit Chance for Spells"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Probabilidad de impacto crítico de los ataques aumentada un (3—7)%","en":"Notable Passive Skills in Radius also grant (3—7)% increased Critical Hit Chance for Attacks"}},
    ],
  },
  {
    id: "ancient-concentrated-liquid-fear",
    name: {"es":"Miedo líquido concentrado antiguo","en":"Ancient Concentrated Liquid Fear"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"suffix","text":{"es":"Las habilidades pasivas pequeñas dentro del radio también otorgan Velocidad de los gritos de guerra aumentada un (2—3)%","en":"Small Passive Skills in Radius also grant (2—3)% increased Warcry Speed"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Bonificación de daño crítico de los hechizos aumentada un (5—10)%","en":"Notable Passive Skills in Radius also grant (5—10)% increased Critical Spell Damage Bonus"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Bonificación de daño crítico del daño de los ataques aumentada un (5—10)%","en":"Notable Passive Skills in Radius also grant (5—10)% increased Critical Damage Bonus for Attack Damage"}},
    ],
  },
  {
    id: "ancient-concentrated-liquid-suffering",
    name: {"es":"Sufrimiento líquido concentrado antiguo","en":"Ancient Concentrated Liquid Suffering"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan +1 al máximo de furia","en":"Notable Passive Skills in Radius also grant +1 to Maximum Rage"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Área de efecto aumentada un (2—3)%","en":"Notable Passive Skills in Radius also grant (2—3)% increased Area of Effect"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan Velocidad de movimiento aumentada un 1%","en":"Notable Passive Skills in Radius also grant 1% increased Movement Speed"}},
    ],
  },
  {
    id: "ancient-concentrated-liquid-isolation",
    name: {"es":"Aislamiento líquido concentrado antiguo","en":"Ancient Concentrated Liquid Isolation"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Los aumentos y las reducciones que afectan al daño de hielo y al daño de rayo dentro del radio se transforman para aplicarse al daño de fuego","en":"Increases and Reductions to Cold and Lightning Damage in Radius are transformed to apply to Fire Damage"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Los aumentos y las reducciones que afectan al daño de fuego y al daño de rayo dentro del radio se transforman para aplicarse al daño de hielo","en":"Increases and Reductions to Fire and Lightning Damage in Radius are transformed to apply to Cold Damage"}},
      {"jewel":"emerald","affix":"prefix","text":{"es":"Los aumentos y las reducciones que afectan al daño de hielo y al daño de fuego dentro del radio se transforman para aplicarse al daño de rayo","en":"Increases and Reductions to Cold and Fire Damage in Radius are transformed to apply to Lightning Damage"}},
    ],
  },
  {
    id: "potent-liquid-melancholy",
    name: {"es":"Melancolía líquida potente","en":"Potent Liquid Melancholy"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"suffix","text":{"es":"Debilitas a los enemigos al impactarlos mientras tengas una esmeralda y un zafiro engarzados","en":"Debilitate Enemies on Hit while you have an Emerald and a Sapphire socketed in your tree"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"Aplicas exposición elemental al impactar mientras tengas un rubí y una esmeralda engarzados","en":"Inflict Elemental Exposure on Hit while you have a Ruby and an Emerald socketed in your tree"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Ciegas a los enemigos al impactarlos mientras tengas un rubí y un zafiro engarzados","en":"Blind Enemies on Hit while you have a Ruby and a Sapphire socketed in your tree"}},
    ],
  },
  {
    id: "potent-liquid-ferocity",
    name: {"es":"Ferocidad líquida potente","en":"Potent Liquid Ferocity"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Efecto de los sufijos aumentado un (40—60)%","en":"(40—60)% increased Effect of Suffixes"}},
      {"jewel":"ruby","affix":"suffix","text":{"es":"Efecto de los prefijos aumentado un (40—60)%","en":"(40—60)% increased Effect of Prefixes"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Efecto de los sufijos aumentado un (40—60)%","en":"(40—60)% increased Effect of Suffixes"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"Efecto de los prefijos aumentado un (40—60)%","en":"(40—60)% increased Effect of Prefixes"}},
      {"jewel":"emerald","affix":"prefix","text":{"es":"Efecto de los sufijos aumentado un (40—60)%","en":"(40—60)% increased Effect of Suffixes"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Efecto de los prefijos aumentado un (40—60)%","en":"(40—60)% increased Effect of Prefixes"}},
      {"jewel":"diamond","affix":"prefix","text":{"es":"Efecto de los sufijos aumentado un (40—60)%","en":"(40—60)% increased Effect of Suffixes"}},
      {"jewel":"diamond","affix":"suffix","text":{"es":"Efecto de los prefijos aumentado un (40—60)%","en":"(40—60)% increased Effect of Prefixes"}},
    ],
  },
  {
    id: "potent-liquid-contempt",
    name: {"es":"Desprecio líquido potente","en":"Potent Liquid Contempt"},
    target: "basic",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"+1 modificador de sufijo permitido","en":"+1 Suffix Modifier allowed"}},
      {"jewel":"ruby","affix":"suffix","text":{"es":"+1 modificador de prefijo permitido","en":"+1 Prefix Modifier allowed"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"+1 modificador de sufijo permitido","en":"+1 Suffix Modifier allowed"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"+1 modificador de prefijo permitido","en":"+1 Prefix Modifier allowed"}},
      {"jewel":"emerald","affix":"prefix","text":{"es":"+1 modificador de sufijo permitido","en":"+1 Suffix Modifier allowed"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"+1 modificador de prefijo permitido","en":"+1 Prefix Modifier allowed"}},
      {"jewel":"diamond","affix":"prefix","text":{"es":"+1 modificador de sufijo permitido","en":"+1 Suffix Modifier allowed"}},
      {"jewel":"diamond","affix":"suffix","text":{"es":"+1 modificador de prefijo permitido","en":"+1 Prefix Modifier allowed"}},
    ],
  },
  {
    id: "ancient-potent-liquid-melancholy",
    name: {"es":"Melancolía líquida potente antigua","en":"Ancient Potent Liquid Melancholy"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"Aumenta el radio a muy grande","en":"Upgrades Radius to Very Large"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"Aumenta el radio a muy grande","en":"Upgrades Radius to Very Large"}},
      {"jewel":"emerald","affix":"prefix","text":{"es":"Aumenta el radio a muy grande","en":"Upgrades Radius to Very Large"}},
      {"jewel":"diamond","affix":"prefix","text":{"es":"Aumenta el radio a muy grande","en":"Upgrades Radius to Very Large"}},
    ],
  },
  {
    id: "ancient-potent-liquid-ferocity",
    name: {"es":"Ferocidad líquida potente antigua","en":"Ancient Potent Liquid Ferocity"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan +(5—7)% a la resistencia al fuego","en":"Notable Passive Skills in Radius also grant +(5—7)% to Fire Resistance"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan +(5—7)% a la resistencia al hielo","en":"Notable Passive Skills in Radius also grant +(5—7)% to Cold Resistance"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan +(5—7)% a la resistencia al rayo","en":"Notable Passive Skills in Radius also grant +(5—7)% to Lightning Resistance"}},
      {"jewel":"diamond","affix":"suffix","text":{"es":"Las habilidades pasivas notables dentro del radio también otorgan +(4—5)% a la resistencia al caos","en":"Notable Passive Skills in Radius also grant +(4—5)% to Chaos Resistance"}},
    ],
  },
  {
    id: "ancient-potent-liquid-contempt",
    name: {"es":"Desprecio líquido potente antiguo","en":"Ancient Potent Liquid Contempt"},
    target: "time-lost",
    outcomes: [
      {"jewel":"ruby","affix":"prefix","text":{"es":"+1 modificador de sufijo permitido","en":"+1 Suffix Modifier allowed"}},
      {"jewel":"ruby","affix":"suffix","text":{"es":"+1 modificador de prefijo permitido","en":"+1 Prefix Modifier allowed"}},
      {"jewel":"sapphire","affix":"prefix","text":{"es":"+1 modificador de sufijo permitido","en":"+1 Suffix Modifier allowed"}},
      {"jewel":"sapphire","affix":"suffix","text":{"es":"+1 modificador de prefijo permitido","en":"+1 Prefix Modifier allowed"}},
      {"jewel":"emerald","affix":"prefix","text":{"es":"+1 modificador de sufijo permitido","en":"+1 Suffix Modifier allowed"}},
      {"jewel":"emerald","affix":"suffix","text":{"es":"+1 modificador de prefijo permitido","en":"+1 Prefix Modifier allowed"}},
      {"jewel":"diamond","affix":"prefix","text":{"es":"+1 modificador de sufijo permitido","en":"+1 Suffix Modifier allowed"}},
      {"jewel":"diamond","affix":"suffix","text":{"es":"+1 modificador de prefijo permitido","en":"+1 Prefix Modifier allowed"}},
    ],
  },
];
