import type { Item, ItemRarity, ItemSlot } from "@shared/domain.js";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type ArtworkKind =
  | "bow"
  | "crossbow"
  | "weapon"
  | "shield"
  | "helmet"
  | "body"
  | "gloves"
  | "boots"
  | "belt"
  | "amulet"
  | "ring"
  | "flask"
  | "other";

const RARITY_GLOW: Record<ItemRarity, string> = {
  normal: "#cbd5e1",
  magic: "#7aa2ff",
  rare: "#f0d46b",
  unique: "#d58b48",
  currency: "#c9a96b",
  gem: "#64d9cb",
  other: "#94a3b8",
};

function artworkKind(item: Item): ArtworkKind {
  const source = `${item.itemClass ?? ""} ${item.baseType}`.toLocaleLowerCase("es");
  if (/ballesta|crossbow/.test(source)) return "crossbow";
  if (/\barco\b|\bbow\b/.test(source)) return "bow";
  const bySlot: Partial<Record<ItemSlot, ArtworkKind>> = {
    weapon: "weapon",
    offhand: "shield",
    helmet: "helmet",
    body: "body",
    gloves: "gloves",
    boots: "boots",
    belt: "belt",
    amulet: "amulet",
    ring1: "ring",
    ring2: "ring",
    flask: "flask",
  };
  return bySlot[item.slot] ?? "other";
}

function Shape({ kind }: { kind: ArtworkKind }) {
  switch (kind) {
    case "crossbow":
      return <><path d="M16 24h32M20 16c7 8 17 8 24 0M32 19v29M27 32h10M29 48l3 7 3-7"/><path d="M18 14l2 8M46 14l-2 8"/></>;
    case "bow":
      return <><path d="M20 8c22 13 22 35 0 48M20 8l15 24-15 24M34 32h18M47 27l5 5-5 5"/></>;
    case "weapon":
      return <><path d="M42 8L24 40M39 10l7-2-1 7M18 42l8-8M15 45l4 4M12 52l7-3-4-4z"/></>;
    case "shield":
      return <path d="M32 8l18 7v13c0 13-7 23-18 28-11-5-18-15-18-28V15zM32 14v35"/>;
    case "helmet":
      return <path d="M16 33v-8c0-11 7-18 16-18s16 7 16 18v8l-7 18-9-8-9 8zm4-4h24M27 29v11m10-11v11"/>;
    case "body":
      return <path d="M22 10l10 5 10-5 9 11-7 7 2 27H18l2-27-7-7zm10 5v36"/>;
    case "gloves":
      return <path d="M19 31V15m6 14V11m7 18V9m7 22V13m0 16 5-8c3-4 7 0 5 4l-8 22c-2 6-7 9-13 9-8 0-14-6-14-14V25c0-5 5-5 5 0z"/>;
    case "boots":
      return <path d="M24 8h17l-3 29 12 7v10H18v-9l7-10zM24 35h14"/>;
    case "belt":
      return <><path d="M8 24h48v16H8zM25 21h14v22H25zM29 27h6v10h-6z"/></>;
    case "amulet":
      return <><path d="M15 10c1 19 8 30 17 30s16-11 17-30"/><path d="M32 37l9 9-9 12-9-12z"/></>;
    case "ring":
      return <><circle cx="32" cy="35" r="17"/><path d="M23 20l9-12 9 12-9 7z"/></>;
    case "flask":
      return <><path d="M25 8h14v10l6 8v24c0 4-3 7-7 7H26c-4 0-7-3-7-7V26l6-8zM24 34h16"/></>;
    default:
      return <><path d="M13 18l19-10 19 10v28L32 56 13 46zM13 18l19 11 19-11M32 29v27"/></>;
  }
}

/**
 * Ilustración local y determinista del tipo de objeto.
 * No pretende reproducir el arte de GGG: evita huecos rotos mientras el texto
 * copiado no incluya un id oficial capaz de resolver una imagen exacta.
 */
export function ItemArtwork({
  item,
  className,
  decorative = true,
}: {
  item: Item;
  className?: string;
  decorative?: boolean;
}) {
  const accent = RARITY_GLOW[item.rarity];
  const label = `${item.name}, ${item.baseType}`;
  return (
    <span
      className={cn("item-artwork relative grid shrink-0 place-items-center overflow-hidden", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
      style={{ "--item-accent": accent } as CSSProperties}
    >
      <svg
        viewBox="0 0 64 64"
        className="size-full p-2"
        fill="none"
        stroke={accent}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <Shape kind={artworkKind(item)} />
      </svg>
    </span>
  );
}
