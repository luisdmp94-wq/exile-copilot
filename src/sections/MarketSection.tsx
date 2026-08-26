import { useState } from "react";
import { Coins, Database, Loader2, PackageSearch, Radar, WalletCards } from "lucide-react";
import type { MetaResponse } from "@shared/api.js";
import type {
  Budget,
  CharacterProfile,
  CurrencyKind,
  GoalKind,
} from "@shared/domain.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MarketState } from "@/hooks/useMarket";
import {
  CURRENCY_LABELS,
  formatDateTime,
  formatNumber,
  GOAL_LABELS,
} from "@/lib/format";

interface MarketSectionProps {
  meta: MetaResponse | null;
  metaLoading: boolean;
  profile: CharacterProfile | null;
  league: string;
  patch: string;
  onLeagueChange: (league: string) => void;
  budget: Budget;
  onBudgetChange: (budget: Budget) => void;
  goal: GoalKind;
  onGoalChange: (goal: GoalKind) => void;
  market: MarketState;
}

const GOALS = Object.keys(GOAL_LABELS) as GoalKind[];
const CURRENCIES = Object.keys(CURRENCY_LABELS) as CurrencyKind[];

/** Origen de las tasas de conversión, en lenguaje discreto para la UI. */
const RATES_ORIGIN_LABELS: Record<"live" | "cache-fresh" | "cache-stale" | "fixture", string> = {
  live: "en vivo (poe.ninja)",
  "cache-fresh": "caché reciente",
  "cache-stale": "caché antigua",
  fixture: "datos de ejemplo",
};

export function MarketSection({
  meta,
  metaLoading,
  profile,
  league,
  patch,
  onLeagueChange,
  budget,
  onBudgetChange,
  goal,
  onGoalChange,
  market,
}: MarketSectionProps) {
  const [namesText, setNamesText] = useState("");
  const { prices, loading, error } = market;

  const leagues = meta?.leagues ?? [];
  const leagueOptions =
    league && !leagues.includes(league) ? [league, ...leagues] : leagues;
  const missingRequirement = !league
    ? "Falta: elige una liga"
    : !namesText.trim()
      ? "Falta: escribe al menos un objeto"
      : null;

  return (
    <Card className="intel-card">
      <CardHeader className="border-b border-border/70 px-6 py-6">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/75">
          <Radar className="size-4" aria-hidden="true" />
          Inteligencia de mercado
        </p>
        <CardTitle className="dossier-title text-3xl">Qué puedes permitirte ahora</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-6 py-6">
        <div className="market-console flex flex-col gap-3 p-5">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
            <Database className="size-4" aria-hidden="true" />
            Terminal de consulta
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(10rem,0.65fr)_minmax(0,1.35fr)]">
            <div className="intel-field">
              <Label htmlFor="market-league">Liga</Label>
              {metaLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={league} onValueChange={onLeagueChange}>
                  <SelectTrigger id="market-league">
                    <SelectValue placeholder="Elige una liga" />
                  </SelectTrigger>
                  <SelectContent>
                    {leagueOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="intel-field">
              <Label htmlFor="market-names">Objetos a consultar</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="market-names"
                  value={namesText}
                  onChange={(e) => setNamesText(e.target.value)}
                  placeholder="p. ej. Exalted Orb, Chaos Orb"
                  className="min-w-56 flex-1"
                />
                {profile && profile.items.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setNamesText(
                        profile.items
                          .map((item) => item.name || item.baseType)
                          .filter((name) => name.length > 0)
                          .join(", "),
                      )
                    }
                  >
                    <PackageSearch className="size-4" aria-hidden="true" />
                    Usar mi equipo
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={loading || missingRequirement !== null}
              onClick={() =>
                void market.queryPrices(
                  league,
                  namesText.split(",").map((n) => n.trim()),
                  patch,
                )
              }
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Coins className="size-4" aria-hidden="true" />
              )}
              {loading ? "Consultando…" : "Consultar precios"}
            </Button>
            {missingRequirement && (
              <p className="text-sm font-medium text-amber-300" role="status" data-testid="market-missing-requirement">
                {missingRequirement}
              </p>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {error && !loading && (
          <Alert variant="destructive">
            <AlertTitle>Error al consultar el mercado</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && !prices && (
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyTitle>Sin consultas todavía</EmptyTitle>
              <EmptyDescription>
                Elige una liga, escribe los nombres de los objetos y pulsa «Consultar
                precios». Los datos proceden de poe.ninja.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {!loading && prices && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                Liga <span className="font-medium text-foreground">{prices.league}</span>{" "}
                · Fuente: <span className="font-medium text-foreground">poe.ninja</span>
                {prices.primaryCurrency && (
                  <>
                    {" "}
                    · Moneda primaria:{" "}
                    <span className="font-medium text-foreground">
                      {CURRENCY_LABELS[prices.primaryCurrency]}
                    </span>
                  </>
                )}{" "}
                · Consultado: {formatDateTime(prices.updatedAt)}
              </span>
              {prices.fromCache && (
                <Badge
                  variant="outline"
                  className="border-sky-500/40 bg-sky-500/10 text-sky-300"
                >
                  desde caché
                </Badge>
              )}
              {prices.degraded && (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/15 text-amber-300"
                >
                  modo degradado
                </Badge>
              )}
            </div>
            {(prices.degraded || prices.rates === null || !prices.rates.verified) && (
              <div className="market-status-grid" aria-label="Estado de verificación del mercado">
                {prices.degraded && (
                  <div className="market-status-line">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">
                      Precios degradados
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Se muestran datos en caché o de ejemplo. Verifica cada precio antes de comprar.
                    </p>
                  </div>
                )}
                <div className="market-status-line">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">
                    Conversión de divisas
                  </p>
                  <p
                    className="text-sm text-muted-foreground"
                    title={
                      prices.rates
                        ? `Tasas recibidas: ${formatDateTime(prices.rates.fetchedAt)}`
                        : undefined
                    }
                  >
                    {prices.rates
                      ? `${RATES_ORIGIN_LABELS[prices.rates.origin]} sin verificar.`
                      : "No hay tasas verificables."} No se puede confirmar si un coste entra en el presupuesto; compara cada precio en su propia moneda.
                  </p>
                </div>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Objeto</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Consultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.quotes.map((quote) => (
                  <TableRow key={quote.itemName}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{quote.itemName}</span>
                        <div className="flex flex-wrap gap-1">
                          {quote.fromCache && (
                            <Badge
                              variant="outline"
                              className="w-fit border-sky-500/40 bg-sky-500/10 text-sky-300"
                            >
                              desde caché
                            </Badge>
                          )}
                          {!quote.verified && (
                            <Badge
                              variant="outline"
                              className="w-fit border-amber-500/40 bg-amber-500/10 text-amber-300"
                            >
                              No verificado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {quote.value === null ? (
                        <span className="text-muted-foreground">No verificado</span>
                      ) : quote.verified ? (
                        formatNumber(quote.value)
                      ) : (
                        <span
                          className="text-muted-foreground/70"
                          title="Valor de referencia sin verificar"
                        >
                          ~{formatNumber(quote.value)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{CURRENCY_LABELS[quote.currency]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(quote.fetchedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <details className="rounded-md border border-border/80 bg-background/35" data-testid="market-context-details">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
            Afinar presupuesto y objetivo (opcional)
          </summary>
          <div className="grid grid-cols-1 gap-5 border-t border-border/70 p-4 sm:grid-cols-2">
            <p className="sm:col-span-2 text-sm leading-relaxed text-muted-foreground">
              Este contexto ayuda a interpretar los resultados, pero no hace falta para consultar precios.
              Un dato sin verificar nunca se presenta como una compra segura.
            </p>
            <div className="intel-field">
              <Label htmlFor="market-goal">Objetivo</Label>
              <Select value={goal} onValueChange={(v) => onGoalChange(v as GoalKind)}>
                <SelectTrigger id="market-goal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOALS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {GOAL_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="intel-field">
              <Label htmlFor="market-budget" className="flex items-center gap-2">
                <WalletCards className="size-3.5 text-cyan-300" aria-hidden="true" />
                Presupuesto
              </Label>
              <Input
                id="market-budget"
                type="number"
                min={0}
                value={budget.amount}
                onChange={(e) => {
                  const parsed = Number.parseFloat(e.target.value);
                  onBudgetChange({
                    ...budget,
                    amount: Number.isNaN(parsed) || parsed < 0 ? 0 : parsed,
                  });
                }}
              />
            </div>
            <div className="intel-field sm:col-span-2">
              <Label htmlFor="market-currency">Moneda del presupuesto</Label>
              <Select
                value={budget.currency}
                onValueChange={(v) =>
                  onBudgetChange({ ...budget, currency: v as CurrencyKind })
                }
              >
                <SelectTrigger id="market-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {CURRENCY_LABELS[currency]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
