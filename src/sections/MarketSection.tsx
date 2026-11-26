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
import { useFormatLabels } from "@/lib/formatLabels";
import { marketName } from "@/lib/marketNames";
import { texts, useText } from "@/i18n/lang";

interface MarketSectionProps {
  meta: MetaResponse | null;
  metaLoading: boolean;
  profile: CharacterProfile | null;
  league: string;
  patch: string;
  onLeagueChange: (league: string) => void;
  budget: Budget | null;
  onBudgetChange: (budget: Budget | null) => void;
  goal: GoalKind;
  onGoalChange: (goal: GoalKind) => void;
  market: MarketState;
}

const GOALS = Object.keys(GOAL_LABELS) as GoalKind[];
const CURRENCIES = Object.keys(CURRENCY_LABELS) as CurrencyKind[];

type RatesOrigin = "live" | "cache-fresh" | "cache-stale" | "fixture";

const TEXT = texts(
  {
    kicker: "Mercado",
    title: "Cuánto cuesta cada cosa hoy",
    query: "Consulta",
    league: "Liga",
    chooseLeague: "Elige una liga",
    itemsToCheck: "Objetos a consultar",
    namesPlaceholder: "p. ej. Orbe exaltado, Orbe divino",
    englishNamesHint: "Sin precio: poe.ninja usa los nombres en inglés. Prueba con el nombre en inglés tal cual sale en la wiki.",
    useMyUniques: "Usar mis únicos",
    missingLeague: "Falta: elige una liga",
    missingItem: "Falta: escribe al menos un objeto",
    querying: "Consultando…",
    queryPrices: "Consultar precios",
    errorTitle: "Error al consultar el mercado",
    source: "Fuente:",
    primaryCurrency: "Moneda primaria:",
    checkedAt: (date: string) => `Consultado: ${date}`,
    fromCache: "desde caché",
    degradedBadge: "modo degradado",
    statusAria: "Estado de verificación del mercado",
    degradedTitle: "Precios degradados",
    degradedBody: "Se muestran datos en caché o de ejemplo. Verifica cada precio antes de comprar.",
    conversionTitle: "Conversión de divisas",
    ratesReceived: (date: string) => `Tasas recibidas: ${date}`,
    ratesUnverified: (origin: string) => `${origin} sin verificar.`,
    noRates: "No hay tasas verificables.",
    cannotConfirm:
      " No se puede confirmar si un coste entra en el presupuesto; compara cada precio en su propia moneda.",
    ratesOrigin: {
      live: "en vivo (poe.ninja)",
      "cache-fresh": "caché reciente",
      "cache-stale": "caché antigua",
      fixture: "datos de ejemplo",
    } as Record<RatesOrigin, string>,
    colItem: "Objeto",
    colPrice: "Precio",
    colCurrency: "Moneda",
    colChecked: "Consultado",
    notVerified: "No verificado",
    unverifiedValue: "Valor de referencia sin verificar",
    contextSummary: "Afinar presupuesto y objetivo (opcional)",
    contextBody1: "Este contexto ayuda a interpretar los resultados, pero no hace falta para consultar precios.",
    contextBody2: "Un dato sin verificar nunca se presenta como una compra segura.",
    goal: "Objetivo",
    budget: "Presupuesto (opcional)",
    budgetPlaceholder: "Sin declarar",
    noBudget: "No has declarado un límite. El Mentor no usará una cifra de ejemplo para decidir por ti.",
    budgetDeclared: (amount: number, currency: string) =>
      `Límite declarado: ${amount} ${currency.toLocaleLowerCase("es")}.`,
    budgetCurrency: "Moneda del presupuesto",
  },
  {
    kicker: "Market",
    title: "What things cost today",
    query: "Price check",
    league: "League",
    chooseLeague: "Choose a league",
    itemsToCheck: "Items to check",
    namesPlaceholder: "e.g. Exalted Orb, Chaos Orb",
    englishNamesHint: "No price: poe.ninja needs the exact English name. Check the spelling.",
    useMyUniques: "Use my uniques",
    missingLeague: "Missing: choose a league",
    missingItem: "Missing: type at least one item",
    querying: "Checking…",
    queryPrices: "Check prices",
    errorTitle: "Couldn't check the market",
    source: "Source:",
    primaryCurrency: "Main currency:",
    checkedAt: (date: string) => `Checked: ${date}`,
    fromCache: "from cache",
    degradedBadge: "fallback mode",
    statusAria: "Market verification status",
    degradedTitle: "Fallback prices",
    degradedBody: "These are cached or example prices. Check each price before you buy.",
    conversionTitle: "Currency conversion",
    ratesReceived: (date: string) => `Rates received: ${date}`,
    ratesUnverified: (origin: string) => `Rates ${origin}, not verified.`,
    noRates: "No verifiable rates.",
    cannotConfirm:
      " We can't confirm whether a cost fits your budget; compare each price in its own currency.",
    ratesOrigin: {
      live: "live from poe.ninja",
      "cache-fresh": "from a recent cache",
      "cache-stale": "from an old cache",
      fixture: "from example data",
    } as Record<RatesOrigin, string>,
    colItem: "Item",
    colPrice: "Price",
    colCurrency: "Currency",
    colChecked: "Checked",
    notVerified: "Not verified",
    unverifiedValue: "Reference value, not verified",
    contextSummary: "Fine-tune budget and goal (optional)",
    contextBody1: "This helps read the results, but you don't need it to check prices.",
    contextBody2: "Unverified data is never shown as a safe buy.",
    goal: "Goal",
    budget: "Budget (optional)",
    budgetPlaceholder: "Not set",
    noBudget: "You haven't set a limit. The Mentor won't use a made-up number to decide for you.",
    budgetDeclared: (amount: number, currency: string) => `Your limit: ${amount} ${currency}.`,
    budgetCurrency: "Budget currency",
  },
);

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
  const t = useText(TEXT);
  const labels = useFormatLabels();
  const [namesText, setNamesText] = useState("");
  const [undeclaredCurrency, setUndeclaredCurrency] =
    useState<CurrencyKind>(budget?.currency ?? "exalted");
  // El aviso de «falta algo» no puede aparecer antes de que el jugador toque
  // nada: al abrir el área no ha cometido ningún error todavía. El botón ya
  // está deshabilitado, que es la señal honesta de partida.
  const [touched, setTouched] = useState(false);
  const { prices, loading, error } = market;
  const uniqueEquipmentNames = Array.from(
    new Set(
      (profile?.items ?? [])
        .filter((item) => item.rarity === "unique")
        .map((item) => item.name.trim())
        .filter(Boolean),
    ),
  );

  const leagues = meta?.leagues ?? [];
  const leagueOptions =
    league && !leagues.includes(league) ? [league, ...leagues] : leagues;
  const missingRequirement = !league
    ? t.missingLeague
    : !namesText.trim()
      ? t.missingItem
      : null;

  return (
    <Card className="intel-card">
      <CardHeader className="border-b border-border/70 px-6 py-6">
        <p className="rotulo-seccion flex items-center gap-2 text-primary/70">
          <Radar className="size-4" aria-hidden="true" />
          {t.kicker}
        </p>
        <CardTitle className="dossier-title text-3xl">{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-6 py-6">
        <div className="market-console flex flex-col gap-3 p-5">
          <p className="rotulo-seccion flex items-center gap-2 text-primary/70">
            <Database className="size-4" aria-hidden="true" />
            {t.query}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(10rem,0.65fr)_minmax(0,1.35fr)]">
            <div className="intel-field">
              <Label htmlFor="market-league">{t.league}</Label>
              {metaLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={league} onValueChange={onLeagueChange}>
                  <SelectTrigger id="market-league">
                    <SelectValue placeholder={t.chooseLeague} />
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
              <Label htmlFor="market-names">{t.itemsToCheck}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="market-names"
                  value={namesText}
                  onChange={(e) => setNamesText(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder={t.namesPlaceholder}
                  className="min-w-56 flex-1"
                />
                {uniqueEquipmentNames.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setNamesText(uniqueEquipmentNames.join(", "))
                    }
                  >
                    <PackageSearch className="size-4" aria-hidden="true" />
                    {t.useMyUniques}
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={loading}
              onClick={() => {
                // Un botón desactivado no explica nada: se puede pulsar y dice qué falta.
                if (missingRequirement) {
                  setTouched(true);
                  return;
                }
                void market.queryPrices(
                  league,
                  // «Orbe exaltado» → «Exalted Orb»: poe.ninja solo sabe inglés.
                  namesText.split(",").map((n) => marketName(n)),
                  patch,
                );
              }}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Coins className="size-4" aria-hidden="true" />
              )}
              {loading ? t.querying : t.queryPrices}
            </Button>
            {touched && missingRequirement && (
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
            <AlertTitle>{t.errorTitle}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && prices && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {t.league} <span className="font-medium text-foreground">{prices.league}</span>{" "}
                · {t.source} <span className="font-medium text-foreground">poe.ninja</span>
                {prices.primaryCurrency && (
                  <>
                    {" "}
                    · {t.primaryCurrency}{" "}
                    <span className="font-medium text-foreground">
                      {labels.currency[prices.primaryCurrency]}
                    </span>
                  </>
                )}{" "}
                · {t.checkedAt(formatDateTime(prices.updatedAt))}
              </span>
              {prices.fromCache && (
                <Badge
                  variant="outline"
                  className="border-border/60 text-muted-foreground"
                >
                  {t.fromCache}
                </Badge>
              )}
              {prices.degraded && (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/15 text-amber-300"
                >
                  {t.degradedBadge}
                </Badge>
              )}
            </div>
            {(prices.degraded || prices.rates === null || !prices.rates.verified) && (
              <div className="market-status-grid" aria-label={t.statusAria}>
                {prices.degraded && (
                  <div className="market-status-line">
                    <p className="rotulo-dato text-amber-300">
                      {t.degradedTitle}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.degradedBody}
                    </p>
                  </div>
                )}
                <div className="market-status-line">
                  <p className="rotulo-dato text-amber-300">
                    {t.conversionTitle}
                  </p>
                  <p
                    className="text-sm text-muted-foreground"
                    title={
                      prices.rates
                        ? t.ratesReceived(formatDateTime(prices.rates.fetchedAt))
                        : undefined
                    }
                  >
                    {prices.rates
                      ? t.ratesUnverified(t.ratesOrigin[prices.rates.origin])
                      : t.noRates}
                    {t.cannotConfirm}
                  </p>
                </div>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.colItem}</TableHead>
                  <TableHead className="text-right">{t.colPrice}</TableHead>
                  <TableHead>{t.colCurrency}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t.colChecked}</TableHead>
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
                              className="w-fit border-border/60 text-muted-foreground"
                            >
                              {t.fromCache}
                            </Badge>
                          )}
                          {!quote.verified && (
                            <Badge
                              variant="outline"
                              className="w-fit border-amber-500/40 bg-amber-500/10 text-amber-300"
                            >
                              {t.notVerified}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {quote.value === null ? (
                        <span className="text-muted-foreground">{t.notVerified}</span>
                      ) : quote.verified ? (
                        formatNumber(quote.value)
                      ) : (
                        <span
                          className="text-muted-foreground/70"
                          title={t.unverifiedValue}
                        >
                          ~{formatNumber(quote.value)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{labels.currency[quote.currency]}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDateTime(quote.fetchedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {prices.quotes.some((quote) => quote.value === null) && (
              <p className="text-xs text-amber-200/85" data-testid="market-names-hint">
                {t.englishNamesHint}
              </p>
            )}
          </div>
        )}

        <details className="rounded-md border border-border/80 bg-background/35" data-testid="market-context-details">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
            {t.contextSummary}
          </summary>
          <div className="grid grid-cols-1 gap-5 border-t border-border/70 p-4 sm:grid-cols-2">
            <p className="sm:col-span-2 text-sm leading-relaxed text-muted-foreground">
              {t.contextBody1} {t.contextBody2}
            </p>
            <div className="intel-field">
              <Label htmlFor="market-goal">{t.goal}</Label>
              <Select value={goal} onValueChange={(v) => onGoalChange(v as GoalKind)}>
                <SelectTrigger id="market-goal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOALS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {labels.goal[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="intel-field">
              <Label htmlFor="market-budget" className="flex items-center gap-2">
                <WalletCards className="size-3.5 text-primary" aria-hidden="true" />
                {t.budget}
              </Label>
              <Input
                id="market-budget"
                type="number"
                min={0}
                value={budget?.amount ?? ""}
                placeholder={t.budgetPlaceholder}
                onChange={(e) => {
                  if (e.target.value.trim() === "") {
                    onBudgetChange(null);
                    return;
                  }
                  const parsed = Number.parseFloat(e.target.value);
                  onBudgetChange({
                    currency: budget?.currency ?? undeclaredCurrency,
                    amount: Number.isNaN(parsed) || parsed < 0 ? 0 : parsed,
                  });
                }}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {budget === null
                  ? t.noBudget
                  : t.budgetDeclared(budget.amount, labels.currency[budget.currency])}
              </p>
            </div>
            <div className="intel-field sm:col-span-2">
              <Label htmlFor="market-currency">{t.budgetCurrency}</Label>
              <Select
                value={budget?.currency ?? undeclaredCurrency}
                onValueChange={(v) => {
                  const currency = v as CurrencyKind;
                  setUndeclaredCurrency(currency);
                  if (budget !== null) onBudgetChange({ ...budget, currency });
                }}
              >
                <SelectTrigger id="market-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {labels.currency[currency]}
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
