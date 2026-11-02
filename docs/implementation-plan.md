# Plan Finder: implementation and verification plan

Source of truth: [`CONTEXT.md`](../CONTEXT.md) (vocabulary, formulas, tie rules), [`docs/v1-plan.md`](v1-plan.md) (scope, build order), [ADR 0001](adr/0001-static-export-browser-only-state.md) (static export, browser-only state, versioned `#c=` share links). This plan follows them and does not reopen them. Code identifiers use CONTEXT.md terms: `careCost`, `annualPremium`, `outOfPocketSpend`, `annualCost`, `oopMax`, `worstCaseCost`, `crossoverPoints`, `cheapestRanges`, `expectedCareCost`, `payFrequency`, `employerContribution`.

## 0. Decisions made in this plan (gaps the docs leave open)

1. **Plan input is kept as strings.** Each field is stored exactly as typed (`PlanInput`). `validatePlan` parses it into a numeric `Plan`. That way nothing gets silently corrected, "abc" shows up as an invalid plan, and share links and the auto-save keep exactly what the user typed.
2. **Parsing accepts formatting only.** Before parsing, `$`, `,`, whitespace, and a trailing `%` (coinsurance only) are stripped. Anything else that is not a plain decimal number makes the plan invalid. Values are never clamped or rounded.
3. **Blank coinsurance means incomplete.** Coinsurance is prefilled, so it can only be blank if the user cleared it. It is then a missing required field.
4. **Contribution type set but amount blank means incomplete** (`missing: ['contribution']`). If the type is None, the amount string is kept but ignored, so switching back to HSA/HRA restores it.
5. **Invalid beats incomplete.** If any filled-in field has an error, the status is `invalid`. Both statuses are excluded from charting.
6. **Worst-case cost** is the annual cost at the plan's maximum out-of-pocket spend. That is `oopMax` when coinsurance > 0. With 0% coinsurance and deductible < OOP max, spend never reaches the OOP max, so it is the deductible. This is "the most that plan can cost in a year".
7. **HRA plans have an extra breakpoint.** Annual cost = annual premium + max(0, spend − HRA), so the line has a kink where spend equals the HRA amount. `breakpoints` includes it.
8. **Blank plan name.** The input keeps the blank value. Chart, summary and table show the display label `Plan N` (N = 1-based position).
9. **Example comparison:** "Low deductible" ($200/mo, $2,000 deductible, 20%, $4,000 OOP max) and "High deductible" ($100/mo, $7,000 deductible, 20%, $10,000 OOP max). Monthly pay frequency, expected care cost $5,000.
10. **Editing after opening a share link** removes the `#c=` fragment (`history.replaceState`). Otherwise a reload would bring back the share link and hide the user's edits.
11. **Length limits are shared by the inputs and the codec:** `NAME_MAX = 60`, `FIELD_MAX = 20` characters. Anything a user can type can be encoded.
12. **No chart tooltip in v1.** The expected-care-cost slider and the breakdown table are the read-out.

## 1. Tooling and layout

### Scaffold by hand

Don't use `create-next-app`: it refuses a folder that contains `CONTEXT.md`.

| File | Content |
|---|---|
| `package.json` | `private: true`. Deps: `next@^16`, `react@^19`, `react-dom@^19`, `recharts@^3`. DevDeps: `typescript@^5`, `@types/react`, `@types/react-dom`, `@types/node`, `@types/bun`, `tailwindcss@^4`, `@tailwindcss/postcss@^4`, `eslint@^9`, `eslint-config-next@^16`. Nothing else. |
| scripts | `"dev": "next dev"`, `"build": "next build"`, `"preview": "python3 -m http.server 4173 --directory out"`, `"test": "bun test"`, `"typecheck": "tsc --noEmit"`, `"lint": "eslint ."`, `"check": "bun run typecheck && bun run lint && bun test && bun run build"` |
| `next.config.ts` | `{ output: 'export', images: { unoptimized: true } }` |
| `tsconfig.json` | Next defaults plus `"strict": true`, `"noUncheckedIndexedAccess": true`, `paths: { "@/*": ["./src/*"] }`, `types: ["bun"]` |
| `postcss.config.mjs` | `{ plugins: { '@tailwindcss/postcss': {} } }` |
| `eslint.config.mjs` | Flat config: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, with global ignores `.next/**`, `out/**`, `next-env.d.ts`. Plus a purity rule: for `src/engine/**`, `src/share/**` and `src/*.ts`, `no-restricted-imports` with patterns `react`, `react-dom`, `next`, `next/*`, `recharts`. |
| `.gitignore` | `node_modules/`, `.next/`, `out/`, `next-env.d.ts`, `*.tsbuildinfo`, `.DS_Store` |

Fonts: don't use `next/font/google`, because it needs network access at build time. The designer picks a system or local font.

### Directory layout

```
src/
  app/
    layout.tsx          html/body, metadata (title "Plan Finder"), imports globals.css
    page.tsx            server component: <Intro/> + <PlanFinder/>
    globals.css         @import "tailwindcss"; design tokens (designer)
  engine/               pure TS, no React/Next imports (lint-enforced)
    types.ts
    validate.ts   + validate.test.ts
    cost.ts       + cost.test.ts
    envelope.ts   + envelope.test.ts
    chart.ts      + chart.test.ts
  share/                pure TS
    codec.ts      + codec.test.ts
    storage.ts    + storage.test.ts
    load.ts       + load.test.ts
  comparison.ts   + comparison.test.ts   factories + example comparison
  format.ts       + format.test.ts       formatUsd, displayName
  summary.ts      + summary.test.ts      cheapest-range sentence
  copy.ts                                ALL user-facing explanatory copy (terms, intro, walkthrough, banners)
  components/
    PlanFinder.tsx      'use client'; owns all state
    PlanCard.tsx
    PayFrequencySelect.tsx
    Term.tsx            label text + InfoPopover for a TermKey
    InfoPopover.tsx
    Results.tsx         composes the results section
    CheapestSummary.tsx
    ResultsChart.tsx
    CareCostSlider.tsx
    BreakdownTable.tsx
    HowToRead.tsx
    ExampleBanner.tsx
    ShareButton.tsx
    Intro.tsx
```

No state library, no barrel files, no UI kit, no popover library. Native `popover`, `<details>`, `<select>` and `<input type="range">` cover everything.

## 2. Engine

### 2.1 `src/engine/types.ts`

```ts
export type PayFrequency = 'weekly' | 'biweekly' | 'semi-monthly' | 'monthly' | 'annual';
export const PAY_FREQUENCIES: readonly PayFrequency[] = ['weekly','biweekly','semi-monthly','monthly','annual'];
export const PAY_PERIODS_PER_YEAR: Record<PayFrequency, number> =
  { weekly: 52, biweekly: 26, 'semi-monthly': 24, monthly: 12, annual: 1 };

export type ContributionType = 'hsa' | 'hra';
export const MAX_PLANS = 6;
export const NAME_MAX = 60;
export const FIELD_MAX = 20;
export const TIE_TOLERANCE = 0.005; // half a cent

/** What the user typed. Strings verbatim. */
export interface PlanInput {
  id: string;            // runtime only, never encoded
  name: string;
  premium: string;       // per pay period
  deductible: string;
  coinsurance: string;   // percent, e.g. "20"
  oopMax: string;
  contributionType: ContributionType | null;
  contribution: string;  // yearly amount; ignored when contributionType is null
}

export interface Comparison {
  plans: PlanInput[];              // 1..MAX_PLANS
  payFrequency: PayFrequency;
  expectedCareCost: number | null; // null = not set
}

/** A complete, valid plan. */
export interface Plan {
  id: string;
  name: string;          // display name (already resolved via displayName)
  premium: number;       // per pay period
  deductible: number;
  coinsurance: number;   // fraction 0..1
  oopMax: number;
  employerContribution: { type: ContributionType; amount: number } | null;
}

export type PlanField = 'premium' | 'deductible' | 'coinsurance' | 'oopMax' | 'contribution';
export interface FieldError { field: PlanField; message: string }
export type PlanStatus =
  | { status: 'valid'; plan: Plan }
  | { status: 'incomplete'; missing: PlanField[] }
  | { status: 'invalid'; errors: FieldError[] };

export interface CheapestRange { from: number; to: number | null; planIds: string[] } // [from, to); last has to = null
export interface CostBreakdown {
  annualPremium: number; outOfPocketSpend: number; contributionOffset: number;
  annualCost: number; worstCaseCost: number;
}
export interface ChartPoint { careCost: number; costs: Record<string, number> } // keyed by plan id
```

### 2.2 `src/engine/validate.ts`

```ts
export function parseAmount(raw: string, opts?: { percent?: boolean }): number | null | 'nan';
export function validatePlan(input: PlanInput, displayName: string): PlanStatus;
```

- `parseAmount` strips `/[\s,$]/g` and, if `percent`, one trailing `%`. An empty result returns `null`. A result that fails `/^-?(\d+\.?\d*|\.\d+)$/` or gives a non-finite `Number(...)` returns `'nan'`. Otherwise it returns the number.
- `validatePlan` checks fields in the order premium, deductible, coinsurance, oopMax, contribution (the last only if `contributionType !== null`):
  - `null` adds the field to `missing`.
  - `'nan'` gives the error "{Label} must be a number".
  - A negative value gives "{Label} can't be negative".
  - Coinsurance above 100 gives "Coinsurance must be between 0% and 100%" (negative coinsurance uses the same message).
  - If deductible and oopMax both parse cleanly and `oopMax < deductible`, add `{ field: 'oopMax', message: "OOP Max can't be less than the deductible" }`.
  - Result: `errors.length` → `invalid`; else `missing.length` → `incomplete`; else `valid`, with `coinsurance = pct / 100`.
  - Labels: Premium, Deductible, Coinsurance, OOP Max, Employer Contribution.

### 2.3 `src/engine/cost.ts`

```ts
export function annualPremium(premium: number, payFrequency: PayFrequency): number; // premium * PAY_PERIODS_PER_YEAR
export function outOfPocketSpend(plan: Plan, careCost: number): number;
  // min(oopMax, min(careCost, deductible) + coinsurance * max(0, careCost - deductible))
export function maxOutOfPocketSpend(plan: Plan): number;     // coinsurance > 0 ? oopMax : deductible
export function spendFlatFrom(plan: Plan): number;           // coinsurance > 0 ? deductible + (oopMax - deductible)/coinsurance : deductible
export function contributionOffset(plan: Plan, outOfPocketSpend: number): number;
  // none → 0; hsa → amount; hra → min(amount, outOfPocketSpend)
export function annualCost(plan: Plan, payFrequency: PayFrequency, careCost: number): number;
  // annualPremium + spend − contributionOffset(plan, spend)   (can be negative)
export function worstCaseCost(plan: Plan, payFrequency: PayFrequency): number;
  // annualCost(plan, payFrequency, spendFlatFrom(plan))
export function breakpoints(plan: Plan): number[];
  // sorted, unique, > 0: deductible, spendFlatFrom(plan), and for HRA with 0 < amount < maxOutOfPocketSpend:
  // amount <= deductible ? amount : deductible + (amount - deductible) / coinsurance
export function costBreakdown(plan: Plan, payFrequency: PayFrequency, careCost: number): CostBreakdown;
```

All costs are non-decreasing in care cost, and every line is constant beyond `max(breakpoints)`. The envelope algorithm relies on both facts.

### 2.4 `src/engine/envelope.ts`

```ts
export function cheapestRanges(plans: Plan[], payFrequency: PayFrequency): CheapestRange[];
export function crossoverPoints(ranges: CheapestRange[]): number[]; // ranges.slice(1).map(r => r.from)
export function cheapestPlanIds(plans: Plan[], payFrequency: PayFrequency, careCost: number): string[];
```

`cheapestRanges` algorithm (exact on piecewise-linear lines):

1. If `plans` is empty, return `[]`.
2. `P` = sorted unique `{0} ∪ breakpoints(p)` over all plans. Every plan is linear on each `[P[k], P[k+1]]` and constant on `[P.last, ∞)`.
3. Events `E = P`. For each interval and each pair (i, j), let `d(x) = annualCost_i(x) − annualCost_j(x)`. If `d0 * d1 < 0` (strictly opposite signs at the endpoints), add the root `x0 + (x1 − x0) * d0 / (d0 − d1)`. No crossings exist in the last open interval because everything there is flat.
4. Sort `E` and drop any event within `1e-6` of the previous one, so three lines through one point don't create a sliver.
5. For each sub-interval `[E[k], E[k+1])`, plus the last `[E.last, ∞)`, take the probe point `x` = midpoint, or `E.last + 1` for the open one. The cheapest set is the ids with `cost − min ≤ TIE_TOLERANCE + 1e-9`, kept in input order. Only open sub-intervals are probed, so lines that touch at a single point never form a range of their own.
6. Merge adjacent sub-intervals with the same id set. Round `from`/`to` to cents (`Math.round(x * 100) / 100`). The first `from` is 0 and the last `to` is `null`.

`cheapestPlanIds` evaluates the same tie rule at one care cost. It is used to highlight the cheapest plan(s) at the expected care cost in the table.

### 2.5 `src/engine/chart.ts`

```ts
export function roundUpNice(value: number): number;
  // smallest m × 10^k ≥ value, m ∈ {1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10}; value ≤ 0 → 0
export function chartExtent(plans: Plan[], expectedCareCost: number | null): number;
  // roundUpNice(max(1000, 1.1 × max over plans of spendFlatFrom, expectedCareCost ?? 0))
export function chartSamples(plans: Plan[], payFrequency: PayFrequency, extent: number): ChartPoint[];
  // x = sorted unique {0, extent, every breakpoint ≤ extent}; costs[plan.id] = annualCost at x
export function crossoverMarkers(ranges: CheapestRange[], plans: Plan[], payFrequency: PayFrequency):
  { careCost: number; annualCost: number }[];
  // for each range after the first: annualCost of its first planId at range.from
```

Because the samples include every breakpoint, Recharts' `type="linear"` lines are exact.

## 3. Share link, auto-save, load order

### 3.1 `src/share/codec.ts`

```ts
export const SHARE_VERSION = 1;
export function encodeComparison(c: Comparison): string;           // "1.<base64url>"
export function decodeComparison(payload: string): Comparison | null; // never throws
export function payloadFromHash(hash: string): string | null;      // /^#?c=(.+)$/ → group 1
export function shareUrl(c: Comparison, loc: { origin: string; pathname: string }): string;
  // `${origin}${pathname}#c=${encodeComparison(c)}`
```

**v1 payload (public contract, never change; add v2 alongside it instead).** Positional JSON, encoded as UTF-8 (`TextEncoder`), then base64url (`btoa`, `+`→`-`, `/`→`_`, strip `=`):

```
[ payFrequencyCode, expectedCareCost, [ [name, premium, deductible, coinsurance, oopMax, contributionType, contribution], ... ] ]
payFrequencyCode: "w" | "b" | "s" | "m" | "a"
expectedCareCost: number | null
contributionType: "" | "hsa" | "hra"
all plan fields: strings, verbatim
```

**`decodeComparison` rules.** Inside `try/catch`, any failure returns `null`:

- The payload is ≤ 6000 chars and matches `/^(\d+)\.([A-Za-z0-9_-]+)$/`.
- The version must be `1`. Unknown versions return `null`. A version switch lets future versions be added.
- `atob`, then `TextDecoder('utf-8', { fatal: true })`, then `JSON.parse`.
- Shape: an array of length 3; a known frequency code; `expectedCareCost` is `null` or a finite number with `0 ≤ x ≤ 1e9`; `plans` is an array of length 1..6.
- Each plan is an array of exactly 7, with all entries strings, name ≤ `NAME_MAX`, numeric fields ≤ `FIELD_MAX`, and type in `"" | "hsa" | "hra"`.
- Plans get fresh ids from `newPlanId()`.

The decoder does not validate numeric content. A share link carrying "abc" opens as an invalid plan, exactly as it was shared.

### 3.2 `src/share/storage.ts`

```ts
export const AUTOSAVE_KEY = 'plan-finder:comparison';
type ReadStore = Pick<Storage, 'getItem'>; type WriteStore = Pick<Storage, 'setItem'>;
export function loadAutoSave(store: ReadStore): Comparison | null;   // decodeComparison(getItem); try/catch → null
export function saveAutoSave(store: WriteStore, c: Comparison): void; // setItem(key, encodeComparison(c)); swallow errors
```

The auto-save reuses the share codec, so it gets versioning and validation for free.

### 3.3 `src/share/load.ts`

```ts
export type ComparisonSource = 'share' | 'autosave' | 'example';
export interface LoadedComparison { comparison: Comparison; source: ComparisonSource; shareLinkFailed: boolean }
export function loadInitialComparison(hash: string, store: ReadStore): LoadedComparison;
```

Order:

1. If `payloadFromHash(hash)` decodes, return `{ source: 'share' }`.
2. Else if `loadAutoSave` succeeds, return `{ source: 'autosave' }`.
3. Else return `exampleComparison()` with source `example`.
4. `shareLinkFailed` is true when a `c=` payload was present but failed to decode.

This function never writes.

### 3.4 State flow in `PlanFinder` (no-clobber rule)

```
state: { loaded: LoadedComparison | null, comparison, edited: boolean, notice: 'share-failed' | null }
mount effect: loaded = loadInitialComparison(location.hash, localStorage)  // prerender renders null state → no hydration mismatch
hashchange listener: if the new hash decodes → replace comparison, source='share', edited=false
update(next): setComparison(next); if (!edited) { edited = true; if (location.hash) history.replaceState(null, '', location.pathname + location.search) }
effect [comparison, edited]: if (edited) saveAutoSave(localStorage, comparison)
```

- Opening a share link, or seeing the example, writes nothing until the first edit.
- Starting from an auto-save also writes nothing until an edit, which is harmless.
- Every user action goes through `update`: field edit, rename, add, remove, frequency change, slider, "start with a blank plan".
- Derived on every render (cheap, so no memo is needed):
  - `statuses = plans.map((p, i) => validatePlan(p, displayName(p, i)))`
  - `valid` = the valid plans
  - `ranges = cheapestRanges(valid, pf)`
  - `extent = chartExtent(valid, ecc)`
  - `samples`, `markers`

### 3.5 `src/comparison.ts`

```ts
export function newPlanId(): string;                         // module counter: "p1", "p2", ...
export function nextPlanName(plans: PlanInput[]): string;    // first of "Plan A".."Plan F" not already used, else "Plan N"
export function newPlanInput(name: string): PlanInput;       // all blank, coinsurance "20", contributionType null
export function blankComparison(): Comparison;               // one new plan "Plan A", monthly, expectedCareCost null
export function exampleComparison(): Comparison;             // decision 9
export function addPlan(c: Comparison): Comparison;          // no-op at MAX_PLANS
export function removePlan(c: Comparison, id: string): Comparison; // no-op when 1 plan
export function updatePlan(c: Comparison, plan: PlanInput): Comparison;
```

### 3.6 `src/format.ts` and `src/summary.ts`

```ts
export function formatUsd(v: number): string;
  // round to cents; "$0" for ±0; whole dollars if cents are 0 ("$3,500"), else 2 decimals ("$8,333.33"); negatives "-$1,300"
export function displayName(p: PlanInput, index: number): string; // trimmed name or `Plan ${index + 1}`
export function cheapestRangeSentence(ranges: CheapestRange[], plans: Plan[], payFrequency: PayFrequency): string;
export function notChartedSentence(items: { name: string; status: 'incomplete' | 'invalid' }[]): string | null;
```

`cheapestRangeSentence` builds the sentence one range at a time, joins the parts with `"; "`, and ends it with `"."`:

- **Subject:**
  - One plan: `"{A} is cheapest"`.
  - Tied plans: `"{A} and {B} are tied for cheapest"`, or `"{A}, {B}, and {C} are tied for cheapest"` (`Intl.ListFormat`, US Oxford comma).
  - If every tied plan has the same cost at `from` and at `to`, and at `from + 1` for the open range (a flat tie), append `" at {formatUsd(cost)}"`.
- **Span:**
  - Only one range: `" at every care cost"`.
  - First range: `" up to {to} of care cost"`.
  - Middle ranges: `" from {from} to {to}"`.
  - Last range: `" from {from} on"`.
- **Edge cases:**
  - 0 valid plans: `"Fill in a plan's premium, deductible and OOP max to see results."`
  - 1 valid plan: `"{A} is the only plan charted; its annual cost runs from {annualCost at 0} to {worstCaseCost}."`

`notChartedSentence` returns `"Not charted: {A} (incomplete), {B} (invalid)."`, or `null` when every plan is valid.

## 4. UI components and state

All components except `Intro` and `HowToRead` are client components, imported under `PlanFinder` (`'use client'`). The props below are the contract. Visuals are the designer's.

| Component | Props | Responsibility |
|---|---|---|
| `PlanFinder` | none | State and derivations (§3.4). Layout: banner/notice, pay-frequency selector, plan cards plus "Add plan", results, share button. Until `loaded` is set, it renders a fixed-height placeholder (no layout shift, no chart). |
| `PlanCard` | `plan: PlanInput; index; status: PlanStatus; payFrequency; canRemove; onChange(p: PlanInput); onRemove()` | A `<fieldset>` whose `<legend>` is the display name. Text inputs (`inputMode="decimal"`, `maxLength=FIELD_MAX`): Plan name (`maxLength=NAME_MAX`, placeholder `Plan N`); Premium (label "Premium per {month\|week\|two weeks\|half-month\|year}", `$` prefix); Deductible; Coinsurance (`%` suffix); OOP Max. Employer Contribution `<select>`: None / HSA / HRA; an amount input appears when not None. Per-field errors use `aria-invalid` and `aria-describedby`. Status line: incomplete → "Not charted yet: add {fields}."; invalid → "Not charted: fix the highlighted fields." Remove button `aria-label="Remove {name}"`, shown only when `canRemove`. |
| `PayFrequencySelect` | `value; onChange` | A native `<select>` labelled via `<Term term="payFrequency">`. Options: Weekly (52 a year), Biweekly (26 a year), Semi-monthly (24 a year), Monthly (12 a year), Annual (1 a year). |
| `Term` | `term: TermKey; children?` | Renders `TERMS[term].label` (or children) plus an `InfoPopover`. Used for every term label in forms, table headers and the slider. |
| `InfoPopover` | `term: TermKey` | `<button popoverTarget={id} aria-label="About {label}">ⓘ</button>` + `<div id={id} popover="auto" role="tooltip"?>` (use plain `popover`, no role). The native Popover API gives Esc, light dismiss and focus return. `id` comes from `useId()`. |
| `Results` | `valid: Plan[]; payFrequency; ranges; expectedCareCost; notCharted; onExpectedCareCostChange` | Composes the summary, chart, slider, table and HowToRead. With 0 valid plans it shows only the summary message. |
| `CheapestSummary` | `sentence; notCharted: string \| null` | A `<p aria-live="polite" data-testid="cheapest-summary">` plus `<p data-testid="not-charted">`. |
| `ResultsChart` | `plans; samples; extent; markers; expectedCareCost; colors: string[]` | Recharts `ResponsiveContainer` inside a container with a **fixed height**, to avoid width(0) warnings. `LineChart data={samples}`. `XAxis type="number" dataKey="careCost" domain={[0, extent]}` with `formatUsd` ticks. `YAxis domain={[(min) => Math.min(0, min), 'auto']}`. One `Line type="linear" dot={false} isAnimationActive={false}` per plan (`dataKey={(d) => d.costs[id]}`, `name` = display name). `ReferenceDot` for each crossover marker. `ReferenceLine x={expectedCareCost}` when set. `ReferenceLine y={0}` when min < 0. Legend. The wrapper gets `data-testid="cost-chart"`, `role="img"`, and `aria-label` = the summary sentence. Axis labels: "Care Cost" and "Annual Cost". |
| `CareCostSlider` | `value: number \| null; max: number; onChange(v: number \| null)` | `<input type="range" min=0 max={max} step=50 aria-label="Expected Care Cost">`, plus a text input "Expected Care Cost amount" that keeps its own raw string. Blank → `null`. A valid number ≥ 0 commits. Invalid input shows "Enter an amount of $0 or more" and doesn't commit. With `null`, the range sits at 0 with `aria-valuetext="Not set"` until it's moved. |
| `BreakdownTable` | `plans; payFrequency; expectedCareCost; cheapestIds: string[]` | `<table data-testid="breakdown">`. One row per valid plan. Columns: Plan, Annual Premium, Out-of-Pocket Spend, Contribution Offset (shown as `formatUsd(-offset)`, or `$0`), Annual Cost, Worst-Case Cost. Care-dependent cells show "—" when `expectedCareCost` is null. Cheapest rows get `data-cheapest="true"` plus a visible "Cheapest" text badge (ties mark all). Horizontal scroll inside its wrapper on narrow screens. |
| `HowToRead` | none | `<details><summary>How to read this chart</summary>…HOW_TO_READ…</details>`. Closed by default. |
| `ExampleBanner` | `onStartFresh()` | Shown while `source === 'example' && !edited`. Text `COPY.exampleBanner`. Button "Start with a blank plan" calls `update(blankComparison())`. |
| `ShareButton` | `comparison` | The button "Copy share link" builds `shareUrl(comparison, location)`, tries `navigator.clipboard.writeText`, then reveals a read-only `<input aria-label="Share link">` holding the URL. Status in `aria-live`: "Link copied" or "Copy the link below". |
| `Intro` | none | `COPY.intro`, above the tool, in `page.tsx`. |

**Focus:**

- After "Add plan", focus moves to the new plan's name input.
- After remove, focus moves to "Add plan".
- "Add plan" is disabled at 6 plans, with the visible hint "Up to 6 plans".

Plan colours come from `PLAN_COLORS[index]`, defined by the designer.

### 4.1 `src/copy.ts`

`export type TermKey = 'premium' | 'payFrequency' | 'annualPremium' | 'deductible' | 'coinsurance' | 'oopMax' | 'employerContribution' | 'hsaContribution' | 'hraContribution' | 'contributionOffset' | 'careCost' | 'outOfPocketSpend' | 'annualCost' | 'expectedCareCost' | 'worstCaseCost' | 'crossoverPoint' | 'cheapestRange'`

`export const TERMS: Record<TermKey, { label: string; body: string }>`. Draft copy, which the implementer may polish but must keep accurate:

- **Premium**: "What you pay for this plan every pay period, whether or not you use any care."
- **Pay Frequency**: "How often premiums come out of your pay. We multiply the premium by the number of pay periods in a year."
- **Annual Premium**: "Your premium times the number of pay periods in a year."
- **Deductible**: "The care cost you pay in full before the plan starts sharing costs."
- **Coinsurance**: "After the deductible, the percentage of each bill you still pay, until you reach the OOP max. Not the same as a copay."
- **OOP Max**: "The most you'll pay for care in a year, counting the deductible and coinsurance. Premiums don't count toward it."
- **Employer Contribution**: "Money your employer puts toward this plan each year, as an HSA or an HRA."
- **HSA Contribution**: "Money that's yours once it's deposited, so it lowers your annual cost in full even if you use no care."
- **HRA Contribution**: "Money that only reimburses care you pay for, so it can't lower your annual cost by more than you spend on care."
- **Contribution Offset**: "How much the employer contribution takes off your annual cost at this care cost."
- **Care Cost**: "The total price of the care you get in a year, before insurance pays anything."
- **Out-of-Pocket Spend**: "What you pay toward care under this plan: the deductible plus coinsurance, never more than the OOP max."
- **Annual Cost**: "Your total for the year: annual premium plus out-of-pocket spend, minus any employer contribution. It can go below zero with an HSA."
- **Expected Care Cost**: "Your best guess at this year's care cost. Move the slider to read off each plan's annual cost."
- **Worst-Case Cost**: "The most this plan can cost you in a year, once your out-of-pocket spend stops growing."
- **Crossover Point**: "A care cost where a different plan becomes the cheapest."
- **Cheapest Range**: "A span of care cost where the same plan, or plans tied together, cost the least."

Also export:

- `COPY.intro`: two sentences. What the tool does, and that the data never leaves the browser.
- `COPY.exampleBanner`: "This is an example comparison. Change any number to make it yours, or start with a blank plan."
- `COPY.shareFailed`: "That share link couldn't be opened, so we loaded {your last comparison | an example comparison} instead."
- `HOW_TO_READ`: a walkthrough of the example.
  - "Each line is one plan's annual cost (up) at a care cost (across)."
  - "High deductible starts cheaper ($1,200 of premiums vs $2,400)."
  - "At $3,500 of care both cost $4,700: that's the crossover point."
  - "Above it Low deductible is cheaper, and its worst case is $6,400 vs $11,200."
  - "Drag the expected care cost to compare at your own guess."

## 5. Engine and module test plan (`bun test`)

Money assertions use `toBeCloseTo(x, 6)`. Ranges and crossovers are rounded to cents and use `toEqual`. Plans are written as (annual premium inputs, deductible, coinsurance %, OOP max, contribution).

### validate.test.ts

| # | Input | Expected |
|---|---|---|
| V1 | All blank, coinsurance "20" | `incomplete`, missing `[premium, deductible, oopMax]` |
| V2 | premium "", others filled | `incomplete`, missing `[premium]` |
| V3 | coinsurance "" | `incomplete`, missing `[coinsurance]` |
| V4 | type `hsa`, contribution "" | `incomplete`, missing `[contribution]` |
| V5 | type `null`, contribution "abc" | `valid`, `employerContribution: null` |
| V6 | premium "abc" | `invalid`, premium "Premium must be a number" |
| V7 | premium "abc", deductible "" | `invalid` (invalid beats incomplete) |
| V8 | deductible "2000", oopMax "1000" | `invalid`, oopMax "OOP Max can't be less than the deductible" |
| V9 | deductible "2000", oopMax "2000" | `valid` |
| V10 | coinsurance "120" / "-5" | `invalid`, coinsurance error |
| V11 | coinsurance "0" / "100" / "20%" | `valid`; coinsurance 0 / 1 / 0.2 |
| V12 | premium "$1,200.50", deductible " 500 " | `valid`; 1200.5, 500 |
| V13 | premium "-1" | `invalid` "Premium can't be negative" |
| V14 | contribution "-100" (hra) | `invalid` |
| V15 | "1e999", "1.2.3", ".", "1e5" | first three `'nan'` → invalid; `parseAmount("1e5")` is `'nan'` (scientific notation rejected by the regex) |
| V16 | "5." and ".5" | parse to 5 and 0.5 |

### cost.test.ts

| # | Case | Expected |
|---|---|---|
| C1 | `annualPremium(100, f)` | weekly 5200, biweekly 2600, semi-monthly 2400, monthly 1200, annual 100 |
| C2 | Example A ($200/mo, 2000, 20%, 4000) `annualCost` at 0 / 2000 / 3500 / 5000 / 7000 / 12000 / 22000 | 2400 / 4400 / 4700 / 5000 / 5400 / 6400 / 6400 |
| C3 | Example B ($100/mo, 7000, 20%, 10000), same points | 1200 / 3200 / 4700 / 6200 / 8200 / 9200 / 11200 |
| C4 | Example A `outOfPocketSpend(5000)`, worst case, breakpoints | 2600; 6400; [2000, 12000] |
| C5 | Example B worst case, breakpoints | 11200; [7000, 22000] |
| C6 | HSA: $150/mo, 3000, 20%, 6000, HSA 1000; cost at 0 / 500 / 2000 / 5000 / 18000 / 30000 | 800 / 1300 / 2800 / 4200 / 6800 / 6800; worst 6800; breakpoints [3000, 18000] |
| C7 | HSA larger than costs: $100/mo, 3000, 20%, 6000, HSA 2500 at 0 | −1300 (negative allowed) |
| C8 | HRA 1000 (same plan as C6) at 0 / 500 / 1000 / 2000 / 5000 / 18000 | 1800 / 1800 / 1800 / 2800 / 4200 / 6800; offset at 500 = 500; breakpoints [1000, 3000, 18000]; worst 6800 |
| C9 | HRA 4000 (above deductible) at 5000 / 8000 / 10000 / 18000 | 1800 / 1800 / 2200 / 3800; breakpoints [3000, 8000, 18000]; worst 3800 |
| C10 | HRA 7000 (≥ OOP max) at 0 / 10000 / 30000 | 1800 everywhere; breakpoints [3000, 18000]; worst 1800 |
| C11 | 0% coinsurance: $100/mo, 1500, 0%, 5000 at 1000 / 1500 / 50000 | 2200 / 2700 / 2700; breakpoints [1500]; worst 2700 |
| C12 | 100% coinsurance: $100/mo, 1000, 100%, 3000 at 500 / 2000 / 3000 / 9000 | 1700 / 3200 / 4200 / 4200; breakpoints [1000, 3000] |
| C13 | $0 deductible: $300/mo, 0, 10%, 2000 at 5000 / 20000 / 30000 | 4100 / 5600 / 5600; breakpoints [20000] (0 excluded) |
| C14 | ded 0, oopMax 0, 0%, annual 3000 | constant 3000; breakpoints [] |
| C15 | `costBreakdown(A, monthly, 5000)` | `{2400, 2600, 0, 5000, 6400}`; with C6 HSA at 5000: `{1800, 3400, 1000, 4200, 6800}` |

### envelope.test.ts

| # | Plans (pay frequency) | Expected `cheapestRanges` | `crossoverPoints` |
|---|---|---|---|
| R1 | Example A, B (monthly) | `[{0,3500,[B]},{3500,null,[A]}]` | `[3500]` |
| R2 | Example (weekly) | B to 18000, then A | `[18000]` |
| R3 | Example (biweekly) | B to 5250, then A | `[5250]` |
| R4 | Example (semi-monthly) | B to 5000, then A; both cost 7400 at 5000 | `[5000]` |
| R5 | Example (annual) | B to 2125, then A | `[2125]` |
| R6 | Example with B premium $150/mo | B to 2750, then A | `[2750]` |
| R7 | A, B, C = $150/mo, 3000, 20%, 6000, HSA 1000 (monthly) | `[{0,16000,[C]},{16000,null,[A]}]` | `[16000]` |
| R8 | Same with C as HRA 1000 | `[{0,600,[B]},{600,16000,[C]},{16000,null,[A]}]` | `[600,16000]` |
| R9 | Single plan A | `[{0,null,[A]}]` | `[]` |
| R10 | `[]` | `[]` | `[]` |
| R11 | Identical plans A and A2 | `[{0,null,[A,A2]}]` (tied, sloped) | `[]` |
| R12 | Partial overlap (annual): X = 1200, 1000, 0%, 1000; Y = 2200, 0, 0%, 0 | `[{0,1000,[X]},{1000,null,[X,Y]}]` | `[1000]` |
| R13 | Touching (annual): T1 = 0, 1000, 20%, 10000; T2 = 500, 0, 50%, 10000 (meet only at 1000, cost 1000) | `[{0,null,[T1]}]` | `[]` |
| R14 | Half-cent tie (annual, constant): 1000.004 vs 1000 | `[{0,null,[A,B]}]` | `[]` |
| R15 | Just outside: 1000.006 vs 1000 | `[{0,null,[B]}]` | `[]` |
| R16 | Three lines through one point (annual): X = 0, 0, 100%, 10000; Y = 1000, 0, 0%, 0; Z = 500, 0, 50%, 10000 | `[{0,1000,[X]},{1000,null,[Y]}]` (Z only touches) | `[1000]` |
| R17 | Six plans (annual, ded 0): F1 0/100%/5000, F2 200/80%/5000, F3 600/60%/5000, F4 1200/40%/5000, F5 2000/20%/5000, F6 3000/0%/0 | F1 [0,1000), F2 [1000,2000), F3 [2000,3000), F4 [3000,4000), F5 [4000,5000), F6 [5000,∞) | `[1000,2000,3000,4000,5000]` |
| R18 | Input order preserved in tied sets | R11 with order A2, A gives `[A2, A]` | n/a |
| R19 | `cheapestPlanIds` example at 5000, semi-monthly | `[A, B]` | n/a |

### chart.test.ts

| # | Case | Expected |
|---|---|---|
| G1 | `roundUpNice` of 24200 / 27500 / 1000 / 1001 / 0 | 25000 / 30000 / 1000 / 1500 / 0 |
| G2 | `chartExtent(example, 5000)` | 25000 |
| G3 | `chartExtent(six plans, null)` (max flat point 25000) | 30000 |
| G4 | `chartExtent([C14], null)` | 1000 (floor) |
| G5 | `chartExtent(example, 40000)` | 40000 |
| G6 | `chartSamples(example, monthly, 25000)` x values | [0, 2000, 7000, 12000, 22000, 25000]; costs at 22000 = {A: 6400, B: 11200} |
| G7 | Breakpoints beyond the extent are excluded; 0 and extent are always present | n/a |
| G8 | `crossoverMarkers(R1)` | `[{careCost: 3500, annualCost: 4700}]` |

### format, summary and comparison tests

| # | Case | Expected |
|---|---|---|
| F1 | `formatUsd` of 3500, 8333.333, -1300, -0.001, 0.5 | "$3,500", "$8,333.33", "-$1,300", "$0", "$0.50" |
| F2 | `displayName({name: "  "}, 2)` | "Plan 3" |
| S1 | Example sentence | "High deductible is cheapest up to $3,500 of care cost; Low deductible is cheapest from $3,500 on." |
| S2 | R12 sentence (names X, Y) | "X is cheapest up to $1,000 of care cost; X and Y are tied for cheapest at $2,200 from $1,000 on." |
| S3 | R8 sentence (B/C/A names) | three parts with "from $600 to $16,000" in the middle |
| S4 | R11 sentence | "A and A2 are tied for cheapest at every care cost." (no "at $": not flat) |
| S5 | Single plan A | "Low deductible is the only plan charted; its annual cost runs from $2,400 to $6,400." |
| S6 | No valid plans | the fill-in message |
| S7 | Three tied names | "A, B, and C are tied…" (Intl.ListFormat, US Oxford comma) |
| S8 | `notChartedSentence` | "Not charted: Plan C (incomplete), Plan D (invalid)."; `null` when empty |
| M1 | `exampleComparison()` validates to 2 valid plans with the numbers in decision 9; expectedCareCost 5000; monthly | n/a |
| M2 | `addPlan` up to 6, 7th is a no-op; names "Plan A".."Plan F", skipping used names; new plan coinsurance "20" | n/a |
| M3 | `removePlan` with 1 plan is a no-op | n/a |

### Share tests (codec.test.ts, storage.test.ts, load.test.ts)

Round-trip comparisons ignore `id`.

| # | Case | Expected |
|---|---|---|
| K1 | Round-trip the example | equal |
| K2 | Round-trip all 5 frequencies, `expectedCareCost` null and 0, HSA and HRA, blank/invalid strings ("abc", "") | equal |
| K3 | Unicode name "Café 🌿 plan", and a name of exactly 60 chars | equal |
| K4 | Six plans | equal |
| K5 | Encoded output matches `/^1\.[A-Za-z0-9_-]+$/` | n/a |
| K6 | **Golden**: pin the literal `encodeComparison(exampleComparison())` string (generate once, then hard-code) and assert decode(literal) equals the example. This locks the public v1 contract. | n/a |
| K7 | Garbage returns `null`: "", "1.", "1.!!!", "abc", "2.<valid v1 body>", "1.<b64 of '{}'>", "1.<b64 of invalid UTF-8 bytes>", 0 plans, 7 plans, plan with 6 entries, number where a string should be, unknown frequency "x", expectedCareCost -1 / "5" / 1e10, name of 61 chars, field of 21 chars, payload of 6001 chars | all `null` |
| K8 | Fuzz: 2000 deterministic pseudo-random strings (seeded LCG over printable ASCII and the base64url alphabet, with and without the "1." prefix) | `decodeComparison` never throws |
| K9 | `payloadFromHash` of "#c=1.abc", "c=1.abc", "", "#x=1", "#c=" | "1.abc", "1.abc", null, null, null |
| K10 | `shareUrl(example, {origin: 'http://localhost:4173', pathname: '/'})` | starts with "http://localhost:4173/#c=1." |
| P1 | `saveAutoSave` with a fake store, then `loadAutoSave` | round-trips |
| P2 | Store whose `getItem` throws, or `setItem` throws | `null`; no throw |
| L1 | Valid hash + store | `source 'share'`, `shareLinkFailed false` |
| L2 | Garbage hash + valid store | `'autosave'`, `shareLinkFailed true` |
| L3 | No hash + valid store | `'autosave'` |
| L4 | No hash + empty or garbage store | `'example'` |
| L5 | Spy store: `loadInitialComparison` never calls `setItem` | n/a |

## Design

Constraints this section keeps: the §4 component boundaries and props, the accessible names and `data-testid`s in §4 and §6, a fixed chart height, no new runtime dependencies, and animations that never block input or log to the console. Where the design needs something §4 doesn't give it, it is listed under D12 as a proposed change rather than assumed.

### D1. Concept: "Roost"

People open this tool at open enrollment, often anxious and short on time. The design should feel like early morning over a fen: pale mist, slate ink, reed ochre, and one flock of starlings. It is calm and editorial, not a dashboard.

**Principles**

1. **The answer comes first.** The cheapest-range sentence is the largest text in the tool. The chart and table back it up.
2. **One calm screen.** Plans go on the left and the answer on the right, and both update as you type. There are no modals, steps or submit button.
3. **Quiet chrome, coloured data.** Only plan lines and plan chips carry colour. Everything else is ink on paper.
4. **Nothing moves while you type.** Motion happens only after you pause, only when the answer has changed, and never under your cursor.
5. **Plain words, real terms.** The labels are the CONTEXT.md terms, and every one has a popover.

**What the starlings mean.** A murmuration is hundreds of birds that each watch only their seven nearest neighbours, yet move as one. Before nightfall it settles onto a roost. Plan Finder uses that literally:

- **Each bird is one possible year.** Every bird stands for a care cost you might have. A wheeling flock is the year you can't predict.
- **The flock roosts on the answer.** When results appear, the flock flies into the chart and settles bird by bird along the lowest line at every care cost. Bird *i* lands at care cost `extent × (i + 0.5) / n` on the cheapest annual cost there. The perched birds trace the cheapest plan across the whole axis, changing line at each crossover point.
- **A changed answer stirs the flock.** When a crossover moves or a different plan becomes cheapest, the birds lift, wheel briefly and resettle on the new lowest line. Small changes that keep the same answer make them hop along their perches, without flying.
- **The sky empties when the answer is ready.** On load, a murmuration wheels in the intro's sky band, then streams out toward the chart. On desktop the chart's flock arrives from the same direction, so the possibilities settle into a decision.

The birds never carry information that isn't stated in words elsewhere: the summary sentence, the crossover rings and the table do that. The "How to read this chart" text explains them in one sentence.

### D2. Palette and theme tokens

Light theme only in v1. Dark mode is **not** in v1: the sky gradient, bird ink and plan colours would each need a second validated set and a second QA pass, so it isn't cheap. Set `color-scheme: light` on `:root` and add `<meta name="color-scheme" content="light">`, so native controls stay light in OS dark mode.

The tokens go in `src/app/globals.css` as Tailwind v4 theme variables. Start the `@theme` block with `--color-*: initial;` so the default Tailwind palette is removed and nobody can drift onto `gray-500`.

```css
@import "tailwindcss";
@custom-variant tall (@media (min-width: 1024px) and (min-height: 760px));

@theme inline {
  --font-sans: var(--font-atkinson), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-newsreader), ui-serif, Georgia, serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
@theme {
  --color-*: initial;
  --color-mist: #F3F1EA;          /* page background */
  --color-paper: #FBFAF6;         /* cards, answer card, chart surface */
  --color-field: #FFFFFF;         /* input/select background */
  --color-sunk: #EDEAE1;          /* table header, pressed, placeholders */
  --color-firstlight: #E3E9E8;    /* top of the intro sky gradient */
  --color-dawn: #E9EEEC;          /* example banner */
  --color-ink: #1E2A2F;           /* primary text (starling slate) */
  --color-ink-2: #46535A;         /* secondary text, labels */
  --color-muted: #5E686C;         /* hints, axis ticks, captions */
  --color-hairline: #DAD5C8;      /* card borders, dividers (decorative) */
  --color-grid: #E6E2D7;          /* chart gridlines */
  --color-axis: #B9B4A6;          /* chart axis line, dashed add-plan border */
  --color-edge: #7E847F;          /* input and select borders (non-text, ≥3:1) */
  --color-focus: #1D6A85;         /* focus ring */
  --color-sheen: #245A5E;         /* the one accent: primary button, slider fill */
  --color-sheen-deep: #1C474B;    /* accent hover/pressed */
  --color-cheapest-wash: #EAF0EC; /* cheapest table row, answer-card settle wash */
  --color-badge: #DCE8E1;         /* "Cheapest" badge background */
  --color-notice-wash: #F6EEDF;   /* share-failed notice */
  --color-error: #A3392A;
  --color-error-wash: #FDF6F3;    /* invalid field background */
  --color-error-line: #E3C2B9;    /* invalid card border */
  --color-success: #2E6A3E;
  --color-success-wash: #E6F0E6;  /* below-$0 chart area */
  --color-bird: #2A3439;
  --color-white: #FFFFFF;

  --radius-sm: 8px;   /* chips, small buttons */
  --radius-md: 10px;  /* inputs, selects, buttons */
  --radius-lg: 14px;  /* plan cards, banners, popovers, table wrapper */
  --radius-xl: 20px;  /* answer card */

  --shadow-card: 0 1px 0 rgb(30 42 47 / 0.04), 0 1px 3px rgb(30 42 47 / 0.06);
  --shadow-raised: 0 1px 2px rgb(30 42 47 / 0.05), 0 10px 28px -14px rgb(30 42 47 / 0.22);
  --shadow-pop: 0 14px 34px -10px rgb(30 42 47 / 0.28), 0 2px 6px rgb(30 42 47 / 0.08);

  --ease-out: cubic-bezier(0.2, 0.7, 0.2, 1);
  --ease-in-out: cubic-bezier(0.45, 0, 0.25, 1);
}
```

**Paper texture.** `body` gets `background-color: var(--color-mist)` plus a static SVG `feTurbulence` noise as a data-URI `background-image` at 3.5% opacity (`baseFrequency 0.9`, 2 octaves, greyscale). It is never animated.

**Contrast**, measured as WCAG 2 ratios. All text pairs meet AA (4.5:1), and the non-text pairs meet 3:1.

| Pair | Ratio | Use |
|---|---|---|
| ink `#1E2A2F` on paper / mist / sunk | 14.09 / 13.02 / 12.23 | body text |
| ink-2 `#46535A` on paper / mist / sunk / dawn | 7.60 / 7.02 / 6.60 / 6.77 | labels, secondary text |
| muted `#5E686C` on paper / mist / white / sunk / firstlight / cheapest-wash | 5.47 / 5.06 / 5.72 / 4.75 / 4.65 / 4.95 | hints, ticks, captions |
| white on sheen `#245A5E` | 7.78 | primary button |
| sheen on badge `#DCE8E1` | 6.18 | "Cheapest" badge |
| error `#A3392A` on white / error-wash / paper | 6.61 / 6.19 / 6.33 | field errors |
| success `#2E6A3E` on paper / success-wash | 6.19 / 5.53 | "Link copied", below-$0 label |
| ink on notice-wash / cheapest-wash | 12.76 / 12.73 | notices, cheapest row |
| edge `#7E847F` on white / paper (non-text) | 3.82 / 3.66 | input borders (WCAG 1.4.11) |
| focus `#1D6A85` on white / paper / mist (non-text) | 6.08 / 5.82 / 5.38 | focus ring |

`axis` (1.98:1) and `grid` are decorative, and the tick labels carry the values. They don't need 3:1.

#### `PLAN_COLORS`

These go in a new pure module, `src/planStyle.ts`. A plan's colour comes from its **position in the comparison** (`PLAN_COLORS[index]`), so an incomplete Plan 2 keeps ochre and Plan 3 keeps heather. A colour never moves to a different plan just because another one stops being charted.

| Slot | Name | Hex | Contrast on paper `#FBFAF6` | Dash (`strokeDasharray`) |
|---|---|---|---|---|
| 1 | Estuary blue | `#2F6DB5` | 5.06 | solid |
| 2 | Reed ochre | `#B0670F` | 4.20 | solid |
| 3 | Heather | `#A24D8F` | 5.03 | solid |
| 4 | Moss | `#5F7F1A` | 4.43 | `9 4` (long dash) |
| 5 | Dusk violet | `#6A5BC4` | 5.15 | `0.5 5` (dots, with round caps) |
| 6 | Fen teal | `#168A6C` | 4.12 | `12 4 2 4` (dash-dot) |

```ts
export const PLAN_COLORS = ['#2F6DB5', '#B0670F', '#A24D8F', '#5F7F1A', '#6A5BC4', '#168A6C'] as const;
export const PLAN_DASHES = [undefined, undefined, undefined, '9 4', '0.5 5', '12 4 2 4'] as const;
export const dashFor = (color: string) => PLAN_DASHES[PLAN_COLORS.indexOf(color as never)];
```

**Validation.** These were checked with the dataviz validator against `#FBFAF6`, in light mode, with the default adjacent pairlist. Every check passes:

- Every colour is inside the OKLCH lightness band 0.43–0.77, with chroma ≥ 0.10.
- The worst adjacent colour-blind ΔE is 14.5 (moss vs heather, deutan); the target is ≥ 8.
- The worst adjacent normal-vision ΔE is 18.6; the floor is 15.
- Every colour is ≥ 3:1 against the chart surface.

Lines cross arbitrarily, so all pairs matter too. No set of six can pass all-pairs, and blue vs violet is the weak pair under deuteranopia. So identity never relies on colour alone:

- Slots 4–6 are dashed. Violet in particular is dotted.
- There is always a legend.
- The ends of the lines are labelled directly on desktop.
- The table names every plan.

There is no red among the plan colours. Red is reserved for errors.

### D3. Typography

There are two Google Fonts, both under the OFL. Use `next/font/local`, because §1 rules out `next/font/google`, which fetches at build time. Commit the Google Fonts latin-subset variable `woff2` files to `src/app/fonts/` along with `OFL.txt`. To get them, fetch `https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400..700&family=Newsreader:opsz,wght@6..72,400..600&display=swap` with a desktop Chrome user agent and save the two `/* latin */` files. They are about 34 KB and 132 KB.

- **Atkinson Hyperlegible Next** (`--font-atkinson`) is for all UI text, inputs and numbers. The Braille Institute designed it to keep characters like 1/l/I and 0/O distinct, which helps people reading numbers under stress.
- **Newsreader** (`--font-newsreader`) is for the title, section headings, the answer sentence and popover titles. It gives the answer a calm, humane voice.

```ts
// src/app/layout.tsx
const sans = localFont({ src: './fonts/AtkinsonHyperlegibleNext-latin.woff2', weight: '400 700', variable: '--font-atkinson', display: 'swap', adjustFontFallback: 'Arial' });
const serif = localFont({ src: './fonts/Newsreader-latin.woff2', weight: '400 600', variable: '--font-newsreader', display: 'swap', adjustFontFallback: 'Times New Roman' });
// <html lang="en" className={`${sans.variable} ${serif.variable}`}>  body: font-sans text-ink
```

| Role | Font | Size / line height (mobile → ≥640px) | Weight | Notes |
|---|---|---|---|---|
| Title "Plan Finder" | Newsreader | 34/38 → 44/48 | 500 | `letter-spacing: -0.01em` |
| Answer sentence | Newsreader | 23/30 → 30/38; 24/32 when the sentence is over 140 chars | 450 | `text-wrap: pretty`, `lining-nums proportional-nums` |
| Section heading (h2) | Newsreader | 20/26 → 22/28 | 500 | "Your plans" |
| Eyebrow (h2 in answer card) | Atkinson | 12.5/16 | 700 | uppercase, `letter-spacing: 0.08em`, muted |
| Intro body | Atkinson | 17/26 → 18/28 | 400 | ink-2, `max-width: 60ch` |
| Body / popover body | Atkinson | 16/24 (popover 15/22) | 400 | |
| Field label | Atkinson | 14/20 | 600 | ink-2 |
| Input text | Atkinson | 16/24 | 500 | 16px so iOS doesn't zoom; `tabular-nums` |
| Plan name input | Newsreader | 20/26 | 500 | |
| Table | Atkinson | 15/22; header 13/18 600 | 400; Annual Cost column 600 | `tabular-nums` |
| Axis ticks, chart labels | Atkinson | 12.5 | 400 | muted, `tabular-nums` |
| Hint / caption / status | Atkinson | 13.5/20 | 400 | muted, or the status colour |

Every money figure in inputs, the table, axis ticks and the slider amount uses `font-variant-numeric: tabular-nums`. Both fonts ship `tnum`. After subsetting, check it in the browser by confirming that the digits in "$1,111" and "$8,888" in a table column line up.

**Spacing scale.** Use Tailwind's 4px base, but only these steps: 1 (4), 2 (8), 3 (12), 4 (16), 5 (20), 6 (24), 8 (32), 10 (40), 14 (56), 20 (80). Card padding is 20 (16 on mobile). The gap between cards is 16. The gap between fields is 16 horizontal and 14 vertical. Section gaps are 32, or 40 at xl.

### D4. Layout

The container is `max-width: 1200px`, centred, with 16px side padding (24px from 640px). There is no top navigation.

**DOM order**, which is also the tab order, as §4 requires:

1. Intro: the sky band, title and intro text.
2. `PlanFinder`, containing:
   1. The example banner or share-failed notice.
   2. "Your plans" with `PayFrequencySelect`, the plan cards and "Add plan".
   3. `Results`.
   4. `ShareButton`.

**Desktop (≥1024px).** Two columns, using `grid-cols-[minmax(360px,420px)_1fr] gap-8`, or `xl:grid-cols-[440px_1fr] xl:gap-10`.

```
┌──────────────────────────────── sky band (180px) ────────────────────────────┐
│ ▸ Plan Finder                                      ~ ~ murmuration ~ ~       │
│ Intro text (2 sentences)                                                     │
│──────────────────────────────── horizon hairline ──────────── • • • perched ─│
├──────────────────────────────────────────────────────────────────────────────┤
│ [example banner .................................... Start with a blank plan] │  full width
├───────────────────────────────┬──────────────────────────────────────────────┤
│ Your plans                    │ ┌ answer card (sticky "live" block) ───────┐ │
│ Pay Frequency ⓘ [Monthly ▾]   │ │ WHICH PLAN IS CHEAPEST                   │ │
│ ┌ plan card ────────────────┐ │ │ High deductible is cheapest up to $3,500 │ │
│ └───────────────────────────┘ │ │ of care cost; Low deductible is …        │ │
│ ┌ plan card ────────────────┐ │ │ Not charted: …                           │ │
│ └───────────────────────────┘ │ │ legend · chart (360px)                   │ │
│ [+ Add plan]                  │ │ Expected Care Cost ⓘ  [$ 5,000]          │ │
│                               │ │ ───────●──────────── (aligned to plot)   │ │
│                               │ └──────────────────────────────────────────┘ │
│                               │ breakdown table                              │
│                               │ ▸ How to read this chart                     │
│                               │ [Copy share link]  Link copied               │
└───────────────────────────────┴──────────────────────────────────────────────┘
```

- The banner or notice spans both columns (`lg:col-span-2`).
- **Sticky answer.** `Results` renders two wrappers. The first is `div.live-track`, which has `flex-1` and contains `div.live`. `div.live` holds the summary, chart and slider, and gets `tall:sticky tall:top-4 tall:z-10`. The second wrapper, `div.detail`, holds the table and HowToRead.

  The `Results` root is `flex flex-col h-full`, and the right grid cell stretches to the height of the left column. So while you edit Plan 5 in a long left column, the answer stays in view. It stops just above the table, because the track ends where `div.detail` begins. When the left column is shorter than the right one, which is the case with the example, nothing sticks. Below 760px of viewport height nothing sticks at all.
- `ShareButton` sits below `Results` in the right column. In the DOM it comes after `Results`, as §4 specifies.

**Tablet (640–1023px).** One column with a maximum width of 720px, centred. The plan-card fields use two columns.

**Mobile (<640px).** One column, in the same order.

- The sky band is 96px tall, and the title sits below the birds.
- Plan cards are full width. The fields use two columns when the card's content box is at least 300px wide, and one column otherwise. Use a container query, `@container (min-width: 300px)`.
- The chart is 300px tall, the end labels are hidden, and the legend wraps above the chart.
- The table scrolls inside its wrapper.
- The share button is full width.

**Loading placeholder** (before `loaded` is set). Draw the same grid with static `bg-sunk/60` rounded blocks: two 260px plan-card blocks, and a 560px answer block on desktop. There is no shimmer and no motion. The heights match the loaded example, so nothing shifts.

**First visit, step by step:**

1. At 0–5s the sky flock wheels in the right 55% of the intro band, splitting in two and rejoining. On mobile it wheels across the full width.
2. The example banner is the first thing in the tool, so it's clear these aren't the user's numbers.
3. The example's answer is already readable in the answer card.
4. At 5–7.5s the sky flock streams down and to the right through the horizon, toward the chart. Nine birds stay perched on the horizon hairline.
5. At about 5.7s the chart flock enters from the top edge of the plot area and roosts by about 8.5s.
6. On mobile, the chart flock arrives when the chart first scrolls at least 40% into view (an IntersectionObserver), with no wait.
7. The banner disappears instantly on the first edit or on "Start with a blank plan".

### D5. Component visual specs

**Global controls**

- **Inputs and selects.** 44px tall, `rounded-md`, a 1px `edge` border and a `field` background, with 12px horizontal padding.
  - Hover: the border changes to `ink-2`.
  - Focus: the border changes to `focus`, plus `box-shadow: 0 0 0 3px rgb(29 106 133 / 0.22)` and a 2px `focus` outline at 2px offset. Inputs show focus on `:focus`.
  - Transitions: border-color and box-shadow, 120ms `--ease-out`.
  - Selects use `appearance: none` with a 12px chevron SVG background at right 12px.
- **`$` and `%` affordances.** The input sits in a `relative` wrapper.
  - `$` is an `aria-hidden` span at left 12px in muted 16px, and the input gets `padding-left: 26px`.
  - `%` sits at right 12px, and the input gets `padding-right: 30px`.
  - The symbols are visual only. The accessible names stay exactly as §4 gives them.
  - Values are left-aligned as typed, never reformatted (decision 1).
- **Buttons.** 44px tall (40px for compact ones inside cards), `rounded-md`, 15px weight 600, with 16px horizontal padding.
  - **Primary** (used only for "Copy share link"): `sheen` background with white text. Hover is `sheen-deep`.
  - **Secondary**: `paper` background, a 1px `edge` border and `ink` text. Hover is `sunk`.
  - **Ghost** (Remove): transparent with `ink-2`. Hover is `sunk`.
  - All buttons move down 1px when pressed.
  - Focus: `:focus-visible` gives a 2px `focus` outline at 2px offset.
  - Icons are 16px inline SVGs with 1.75 stroke and `aria-hidden`.

**Plan card** (`PlanCard`)

The card is a `<fieldset>` with `bg-paper`, a 1px `hairline` border, `rounded-lg`, `shadow-card` and 20px padding. It carries `data-status={status.status}` for styling.

- The `<legend>` holds the display name and is visually hidden (`sr-only`). The name input is the visible title, so the name isn't shown twice.
- **Header row:**
  - The colour chip.
  - A stack containing the small visible label "Plan name" (12.5px, muted) and the name input.
  - The Remove button on the right: 36×36 on desktop, 44×44 on mobile, with an "×" icon.
- **Name input:** Newsreader 20px, with a transparent background and no box. A 1px dotted `axis` underline turns into a solid 2px `focus` underline on focus. The placeholder is `Plan N` in muted.
- **Colour chip:** an `aria-hidden` 28×12 SVG. A line runs from (2,6) to (21,6) in the plan colour, 2.5px wide, with the plan's dash and round caps. An end dot at (24,6) has r=3 with a 1.5px paper ring. When the plan isn't charted, the chip drops to 35% opacity and the end dot is hollow. The same chip is used in the legend, the table and the end labels.
- **Field grid:** two columns (one below 300px).
  - Row 1: Premium per {period} | Deductible.
  - Row 2: Coinsurance | OOP Max.
  - Row 3: Employer Contribution | the amount.
  - Each label row is the label text followed by the ⓘ button, 4px apart and baseline-aligned. Below each input is an error slot.
- **HSA/HRA control.** The native `<select>` (None / HSA / HRA) goes in the left cell. The right cell is reserved at all times, so choosing an option never shifts the layout:
  - With None, it shows the muted text "No employer money" at input height, vertically centred.
  - With HSA or HRA, it shows the amount input. Its label is "HSA Contribution per year" or "HRA Contribution per year", rendered through `Term` with `hsaContribution` or `hraContribution`. That way the popover explaining the difference sits right where the choice is made. It has a `$` prefix.
  - The amount input fades in over 140ms.
- **Incomplete** (calm, not an error). The missing fields get no red styling. A status line at the bottom of the card, behind a hairline top divider with 12px padding, reads "Not charted yet: add {fields}." in 13.5px `ink-2`, after a 12px hollow ring icon.
- **Invalid.**
  - Each field with an error gets the `error` border, an inset `box-shadow: inset 0 0 0 1px var(--color-error)` to make it 2px without shifting the layout, and the `error-wash` background.
  - The message sits below the field in 13.5px `error`, after a 14px "!" circle icon, and is referenced by `aria-describedby`.
  - The card border changes to `error-line`.
  - The status line reads "Not charted: fix the highlighted fields." in `error`, with the same icon.
- **Valid.** There is no status line, and the chip is solid.
- **New card entrance:** opacity 0→1 and translateY 8px→0 over 220ms `--ease-out`. Removal is instant, and focus moves to "Add plan".

**Add plan.** A full-width button 56px tall, `rounded-lg`, with a 1.5px dashed `axis` border, a transparent background, `ink-2` text and a "+" icon: "Add plan". Hover gives an `edge` border and `paper` background. When disabled at 6 plans, it drops to 55% opacity with `cursor: not-allowed`, and the hint "Up to 6 plans" appears beside it in muted 13.5px.

**Pay frequency.** This row sits above the cards, under the h2 "Your plans". It is the `Term` label, then a 240px select (full width on mobile), then the muted hint "Applies to every plan."

**Info popover** (`InfoPopover`)

- **Trigger:** a 24×24 hit area holding a 16px SVG: a circle with an "i", 1.5px stroke, in muted. Hover and focus turn it `sheen`. The ⓘ text character is replaced by the SVG, and the `aria-label` doesn't change.
- **Panel:** `popover` (auto).
  - `bg-field`, a 1px `hairline` border, `rounded-lg`, `shadow-pop`, 14px 16px padding, `max-width: min(320px, calc(100vw - 24px))`.
  - The title is the term label in Newsreader 17px weight 600, and the body is 15/22 `ink-2`.
  - Reset the UA popover styles: `margin: 0; inset: auto`.
- **Positioning** takes about 20 lines of JS in `InfoPopover`.
  - On the `beforetoggle` event with `newState === 'open'`, measure the trigger's `getBoundingClientRect()`. Set `position: fixed`, with `top = rect.bottom + 8` and `left = clamp(12, rect.left - 12, innerWidth - width - 12)`.
  - If there's less than 180px below the trigger, flip the panel above it.
  - While it's open, reposition on `scroll` (capture, passive) and on `resize`, and remove the listeners on close.
  - Don't use CSS anchor positioning, because browser support is uneven.
- **Animation:** opacity 0→1 and translateY 4px→0 over 140ms `--ease-out`, using `@starting-style` and `transition-behavior: allow-discrete`. Closing takes 100ms.

**Answer card** (`CheapestSummary` inside `div.live`)

The card is `bg-paper`, `rounded-xl`, `shadow-raised`, with 28px 32px padding (20px on mobile). It is the visual hero of the page.

- **Eyebrow:** an `<h2>` reading "Which plan is cheapest". It sits outside the `aria-live` paragraph.
- **The sentence:** `<p aria-live="polite" data-testid="cheapest-summary">` in the answer style. It updates on every keystroke.
- **Not charted:** `<p data-testid="not-charted">` 8px below, in muted 14.5px, after a hollow ring icon. Render nothing when there's no not-charted sentence.
- **No valid plans:** the card shows the fill-in message in Newsreader 23px `ink-2`, and nothing else.
- **Settle wash:** when the answer's signature changes (see D6), the card background goes from `cheapest-wash` to `paper` over 900ms `--ease-in-out`, at the same moment the flock lifts. It never runs per keystroke.

**Chart** (`ResultsChart`)

- **Container:** fixed height `h-[300px] sm:h-[360px]`, holding `ResponsiveContainer width="100%" height="100%"`. Sizes:

  | | Desktop | Mobile |
  |---|---|---|
  | `LineChart` margin | `{ top: 28, right: 104, bottom: 8, left: 4 }` | `right: 16` |
  | YAxis `width` | 68 | 54 |

  Set `accessibilityLayer={false}` on `LineChart`. The wrapper already has `role="img"`, and v1 has no tooltip.
- **Lines:** `strokeWidth={2.5}`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `strokeDasharray={dashFor(color)}`, `dot={false}`, `activeDot={false}`, `isAnimationActive={false}`. They don't animate, so the lines track your typing exactly. The flock supplies the sense of change.
- **Gridlines:** `CartesianGrid vertical={false} stroke="var(--color-grid)" strokeWidth={1}`, solid.
- **X axis:**
  - `ticks = [0,1,2,3,4,5].map(i => extent * i / 5)`. `roundUpNice` keeps these clean.
  - `tickLine={false}`, `axisLine={{ stroke: 'var(--color-axis)' }}`, with ticks at 12.5px in muted.
  - Label "Care Cost": `position: 'insideBottomRight'`, 13px weight 600 `ink-2`, offset -2. Leave 24px of bottom margin for it.
- **Y axis:**
  - `domain` as in §4, `tickCount={5}`, `axisLine={false}`, `tickLine={false}`.
  - Label "Annual Cost": horizontal, at `position: 'top'`, aligned left with `dx` equal to half the YAxis width, 13px weight 600 `ink-2`.
- **Tick format** (a local helper): `formatUsd` when the axis's largest absolute value is under 10,000. Otherwise use compact form: `$5k`, `$12.5k`, `-$1.2k`. Use one style per axis.
- **Crossover markers:** one `ReferenceDot` each, `r={6}`, `fill="var(--color-paper)"`, `stroke="var(--color-ink)"`, `strokeWidth={2}`. This is the "ring" the copy refers to.
  - Label it with `formatUsd(careCost)` above the ring, 12px muted, using `tabular-nums`.
  - Only label when there are at most 3 crossovers and the plot is at least 420px wide. Otherwise the summary already gives the amounts.
- **Expected care cost:** a `ReferenceLine x` with `stroke="var(--color-ink-2)"`, `strokeWidth={1.5}`, `strokeOpacity={0.7}`, solid.
  - Its label is a custom pill at the top of the plot: a `paper` rect, a 1px `hairline` stroke, rx 6, and the text "Expected {formatUsd}" at 12px in `ink-2`.
- **Below $0** (only when min < 0):
  - A `ReferenceLine y={0}` with `stroke="var(--color-edge)"` and width 1.
  - A `ReferenceArea` from `y1={yMin}` to `y2={0}`, `fill="var(--color-success-wash)"`, `fillOpacity={0.6}`, `ifOverflow="extendDomain"`.
  - Label it "Below $0: you come out ahead" at `insideBottomLeft`, 12px `success`.
  - Neither element adds a `.recharts-line` or `.recharts-reference-dot`, so Q1's counts hold.
- **Legend:** `<Legend verticalAlign="top" align="left">` with custom `content`. Each entry is a row of chips and names (`ink-2`, 14px), with 16px between entries and 12px below the row. It wraps on mobile.
- **End labels** (desktop only, plot width ≥ 480px): rendered by `ChartOverlays` (D6).
  - Each label is a chip plus the display name, cut to 14 characters with "…", at 13px in `ink-2`. Text uses text tokens, never the plan colour.
  - Place each label 10px right of the plot at the line's final y.
  - Sort the labels by y and push them apart so they're at least 16px apart, clamped to the plot area.
- **Overlays:** they render last, so they sit on top. They are `aria-hidden` with `pointer-events: none`. They must not use `Line` or `ReferenceDot`.

**Slider** (`CareCostSlider`)

- **Header row:** the `Term` label "Expected Care Cost" on the left. On the right is the "Expected Care Cost amount" text input, 150px wide, with a `$` prefix.
- **Track alignment:** the range sits in a wrapper with `padding-left: calc(68px + 4px - 11px)` and `padding-right: calc(104px - 11px)`, or `54/16` on mobile. This puts the thumb's centre under the reference line, within about 1px. Results passes `max={extent}`.
- **Track:** 4px tall and rounded, in `hairline`. The filled part, from 0 to the value, is `sheen`. Draw it with a `linear-gradient` driven by the `--pct` custom property.
- **Thumb:** 22px, `field` fill, a 2px `sheen` border and `shadow-card`. Focus adds a 2px `focus` outline at 3px offset.
- **Not set** (`null`):
  - The thumb is hollow, with a dashed 2px `edge` border, and the track has no fill.
  - The hint below reads "Not set. Drag the slider or type an amount to compare plans at your best guess."
- **Error:** "Enter an amount of $0 or more" in the error style under the text input.

**Breakdown table** (`BreakdownTable`)

- **Wrapper:** `overflow-x-auto`, `rounded-lg`, a 1px `hairline` border and `bg-paper`. Add `tabIndex={0}`, `role="region"` and `aria-label="Cost breakdown"` so keyboard users can scroll it.
- **Caption:** a visible `<caption>` above the table, left-aligned in muted 13.5px. It reads "Costs at {formatUsd(expected)} of care cost", or "Set an expected care cost to fill in the middle columns" when there isn't one.
- **Header row:** `bg-sunk`, `ink-2`, 13px weight 600. Each header uses `Term` and wraps to two lines at most.
- **Rows:** 48px tall with 1px `grid` dividers. Numbers are right-aligned with `tabular-nums`.
  - The Plan column has the chip and the name in `ink`. Showing the chip needs the D12 R2 colours.
  - Annual Cost is weight 600 `ink`, and Worst-Case Cost is `ink-2`.
  - The "—" cells are muted.
  - Negative values stay `ink`; the minus sign already says it.
- **Cheapest row:** `bg-cheapest-wash`. The "Cheapest" badge sits after the name: a pill 20px tall with 8px horizontal padding, `bg-badge`, `sheen` text, 12px weight 700, and a 12px perched-bird glyph (the same path as a perched bird in D6) before the word. So the birds roost on the cheapest plan in the table too.
- **Mobile:** the first column is `position: sticky; left: 0` with its row's background, so the names stay in view while the table scrolls.

**Share** (`ShareButton`)

- "Copy share link" is a primary button with a link icon. Next to it is an `aria-live` status: "Link copied" in `success` with a check icon, or "Copy the link below" in `ink-2`. The status fades in over 150ms and clears after 4s.
- The read-only "Share link" input appears below at full width, using the mono font at 13.5px with a `sunk` background. It selects all on focus.
- Under the input, muted 13.5px: "Anyone with this link sees these plans. Nothing is stored on a server."
- The copy flourish is described in D6.

**Example banner and share-failed notice**

- **Example banner:** `rounded-lg`, 14px 18px padding, `bg-dawn`, a 1px `#CFD8D5` border.
  - On the left is a 20px glyph of three small birds in `bird` at 70%, then `COPY.exampleBanner` in `ink`.
  - On the right is the secondary button "Start with a blank plan". It stacks under the text on mobile.
- **Share-failed notice:** the same layout with `bg-notice-wash`, an info-circle icon and `COPY.shareFailed`. It clears on the first edit, like the banner (see D12 R6).

**How to read this chart** (`HowToRead`)

- The `<summary>` is a 44px row: a chevron, then "How to read this chart" at 15px weight 600 `ink`. The chevron rotates 90° over 160ms when open.
- The body is an ordered list at 15/24 in `ink-2`, inside a `paper` panel with `rounded-lg` and 16px 20px padding.
- Where `::details-content` transitions are supported, the content fades in over 160ms. Otherwise it appears instantly.

### D6. Motion

**Shared tokens**

- Durations: fast 120ms (hover and borders), base 180ms, popover 140ms, settle 380–900ms.
- Easing: `--ease-out` for anything entering, `--ease-in-out` for washes.

**Micro-interactions**

- **Chart lines:** no transition (§4 sets `isAnimationActive={false}`).
- **Summary:** the text swaps instantly. Only the settle wash animates (D5).
- **Cards:** the entrance in D5. There is no exit animation.
- **Copy feedback:** on a successful copy, one starling lifts from the button's top-right corner. It is the flock's gliding starling silhouette (`flyingBirdPath` in `src/flock.ts`), 10px, filled in `bird` and heading up and right, inside an `aria-hidden` absolutely positioned span. It flies up and right by `translate(36px, -28px)` while fading from 0.8 to 0 over 700ms `--ease-out`, using a CSS keyframe. "Link copied" fades in at the same time.

**Reduced motion.** This is global CSS:

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

The flocks have their own fallback, below.

#### Files

| File | Kind | Role |
|---|---|---|
| `src/flock.ts` | pure TS, no React; passes the purity lint | Seeded PRNG, simulation and path building |
| `src/components/Murmuration.tsx` | `'use client'` | `useReducedMotion`, `useFlockLoop`, `<SkyMurmuration/>` and `<RoostFlock/>` |
| `src/components/ChartOverlays.tsx` | `'use client'` | Rendered as the last child of `<LineChart>`. It uses Recharts 3 `useXAxisScale()`, `useYAxisScale()` and `usePlotArea()`, all exported in 3.10, and renders the end labels plus `<RoostFlock/>`. If a scale is `undefined`, it renders `null`. |

`Intro` stays a server component and renders the client `<SkyMurmuration/>`. `ResultsChart` keeps its props and renders `<ChartOverlays samples={samples} markers={markers} extent={extent} plans={plans} colors={colors} />`. If the installed Recharts doesn't render plain children inside the chart, use `<Customized component={…}/>`.

#### Simulation (`src/flock.ts`)

```ts
export interface FlockParams { minSpeed: number; maxSpeed: number; maxForce: number; k: number; sepRadius: number;
  wSep: number; wAli: number; wCoh: number; wHome: number; edge: number }
export const SKY: FlockParams   = { minSpeed: 38, maxSpeed: 92,  maxForce: 140, k: 7, sepRadius: 9, wSep: 1.6, wAli: 1.0, wCoh: 0.55, wHome: 0.35, edge: 24 };
export const ROOST: FlockParams = { minSpeed: 45, maxSpeed: 115, maxForce: 180, k: 7, sepRadius: 7, wSep: 1.6, wAli: 1.0, wCoh: 0.6,  wHome: 0.6,  edge: 12 };
export interface Flock { n: number; x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array;
  tx: Float32Array; ty: Float32Array; state: Uint8Array /* 0 fly, 1 landing, 2 perched, 3 gone */; far: Uint8Array;
  bank: Float32Array /* smoothed turn rate */; rand: () => number }
export function mulberry32(seed: number): () => number;
export function createFlock(n: number, seed: number, cx: number, cy: number, radius: number): Flock;
// home: one point for the flock, or { x: Float32Array; y: Float32Array } with one per bird
export function step(f: Flock, dt: number, p: FlockParams, home: Point | Homes, bounds: { x: number; y: number; w: number; h: number } | null): void;
export function setPerches(f: Flock, xs: ArrayLike<number>, ys: ArrayLike<number>): void; // targets; doesn't change state
export function land(f: Flock, i: number): void;         // state 0 → 1
export function liftOff(f: Flock): void;                 // perched → fly, vy = -(40..80), vx ± 30
export function settled(f: Flock): boolean;
export function snapToPerches(f: Flock): void;
export function paths(f: Flock, scale?: number, t?: number /* seconds, drives the wingbeat */): { near: string; far: string; perched: string };
export function flyingBirdPath(x: number, y: number, angle: number, scale: number): string; // the gliding silhouette
// The sky timeline, pure so bun test runs it end to end:
export function createSky(f: Flock, w: number, h: number): Sky;
export function stepSky(s: Sky, dt: number): boolean;   // false once over
export function skyFade(s: Sky): number;                 // opacity of the flying birds
export function finishSky(s: Sky): void;                 // only the nine horizon birds remain, perched
```

- **Boids, the topological way.** Each flying bird looks at its **k = 7 nearest** flying neighbours. For each bird, scan all the others and keep the 7 nearest by insertion into fixed-size scratch arrays. That costs O(n²·7) with no allocation.
  - **Separation:** steer away from neighbours closer than `sepRadius`, weighted by 1/d.
  - **Alignment:** steer toward the neighbours' average velocity.
  - **Cohesion:** steer toward their centroid.
  - **Home:** steer toward the moving attractor, or toward each bird's own home when `home` is per bird.
  - **Edge:** a soft force inward within `edge` px of the bounds.
  - Clamp the force to `maxForce` and the speed to `[minSpeed, maxSpeed]`. Use semi-implicit Euler, with `dt` clamped to 1/30s.
  - **Bank:** each step also smooths the bird's turn rate into `bank` (time constant 0.18s). Only the drawing uses it.
- **Turning waves.** Every 2.5–4s, picked at random, rotate one bird's velocity by ±40°. Alignment passes the turn through the flock as a ripple, the way information spreads through a real murmuration.
- **Landing (state 1).** Use an arrival force toward `(tx, ty)` with a slowing radius of 40px, and ignore the boid forces. When the bird is within 0.6px and slower than 5px/s, snap it to the perch and set `state = 2`.
- **Hard cap.** Any bird not perched 3.2s after a roost sequence starts lerps to its perch over 300ms.
- **Drawing.** There are three `<path>` elements, so each frame costs three `setAttribute('d', …)` calls and no React renders.
  - **Near birds** are a starling from below: a small filled four-pointed star with pointed, swept wings and a short square tail. It's about 8×4px, oriented along the velocity. It has three wingbeat frames: level, downstroke with the wings forward, and upstroke with the wings raised and foreshortened. They ping-pong at 16 frame changes a second, which is 4 beats a second. A bird flaps while climbing (heading more than 0.3 upward) and in bursts otherwise: the first 38% of each 1.2s cycle, with a per-bird phase from the golden ratio of its index. The rest of the time it glides with its wings fully out and swept back. This "flap–glide" rhythm keeps the flock calm.
  - **Far birds** (half, seeded) are specks: a small filled crescent across the heading whose width is the wings. Straight and level it shows little, about 2.6px. In a turn it banks and shows the whole wing plane, up to about 7px, scaled by `|bank| / 1.4`. So a turning wave darkens across the flock, as in a real murmuration. A faint 4Hz shimmer stands in for the wingbeat. Far birds are simpler than near ones, which gives depth.
  - Both are filled in `bird`: near at opacity 0.72, far at 0.34.
  - **Perched birds** are a filled side-view starling about 12×8px (tail, back, crown, beak, breast and legs), with feet on the perch point. Each is flipped left or right by a seeded coin, with seeded x jitter of ±1.5px so the row looks organic. The fill is `bird` at opacity 0.8. On the chart, the perch y is the line's y minus 1.5px.
  - The glyphs were chosen on the throwaway branch `prototype/murmuration-variants`, which keeps the alternatives that were compared (the old stroked chevron, a side-view flyer, ribbon, teardrop and funnel flock shapes). The V chevron didn't read as a starling, while the perched silhouette did and stays as it was.

#### Sky flock (`<SkyMurmuration className?: string />`)

- **Where:** an absolutely positioned `<svg aria-hidden="true" focusable="false">` inside the Intro sky band.
  - On desktop it covers the right 55% of the band, 180px tall. On mobile it covers the full width, 96px tall.
  - It is never behind text.
  - The band background is `linear-gradient(180deg, var(--color-firstlight) 0%, #EEF0EB 55%, var(--color-mist) 100%)`.
  - The band ends in a 1px `axis` horizon hairline.
- **Birds:** 150, or 80 below 768px. They start as a seeded cluster with a 30px radius at 60% of the band width, at mid-height.
- **Shape: split and rejoin.** The flock follows a slow, flattened Lissajous, `x = w/2 + 0.32w·sin(0.11t)` and `y = h/2 + 0.08h·sin(0.17t + 1)`.
  - At 0.2s it is cut into two unequal halves (42/58) by geography, along a direction of 0.2 rad. Cutting by index would leave the halves interleaved, and the boids would hold them together.
  - Each half steers toward its own home, offset either side of the Lissajous point by up to 0.28w. The offset rises and falls as `sin(πk)^0.7`, with `k` going from 0 to 1 over 0.2–3.7s, and turns through 2.4 rad, so the halves part and swap sides. The vertical offset is capped at 0.3h to keep them inside the band.
  - By 3.7s they share one home again, leaving 1.3s as one flock before it leaves.
  - Params while wheeling are `SKY` with `maxSpeed 110, maxForce 200, wHome 1.6, wAli 0.8, wCoh 0.5`.
- **Timeline** (constants in `src/flock.ts`):
  - 0–5s (`SKY_WHEEL`): split and rejoin.
  - 5s: everyone streams toward `(0.7w, h + 60)`, down and right through the horizon, with the faster `LEAVE` params: `SKY` with `minSpeed 70, maxSpeed 180, maxForce 260, wHome 1.6, wAli 0.7, wCoh 0.3`. Birds more than 10px outside the bounds are removed, and the edge force is off for this phase.
  - At the same moment, 9 birds land on perches spaced evenly along the horizon, across the right 30% of the band.
  - The stream-out ends when the flock has gone and the 9 have perched (usually 6.2–7.2s). It is cut off at 7.5s (`SKY_LEAVE` 2.5s after the wheel). Any stragglers fade out over the last 0.8s (`SKY_FADE`), so the flock never vanishes all at once. Then the loop **stops for good**.
  - The old exit kept the wheeling params and aimed at `(w + 60, h + 40)`. It left most of the flock in the band at its cutoff, and they vanished in one frame.
  - The chart flock's arrival is timed from page load, at `SKY_WHEEL` + 0.7s = 5.7s. Nothing is signalled between the two flocks.
- **Pausing:** pause while the band is less than 10% visible (IntersectionObserver) or the tab is hidden. Paused time doesn't count toward the timeline.
- **Reduced motion:** render only the 9 perched birds on the horizon, statically. There is never a flight.

#### Chart flock (`<RoostFlock perches signature plot />`, inside `ChartOverlays`)

- **Birds:** 56, or 36 when the plot is under 480px wide.
- **Perches:** for each bird, `xData = extent × (i + 0.5) / n`. `yData` is the lower envelope at `xData`, found by linear interpolation over the sorted union of `{ (s.careCost, min(Object.values(s.costs))) for s in samples }` and `markers`.

  This is exact. Between consecutive breakpoints every line is linear, so the minimum only kinks where the cheapest set changes, and those are the crossover markers. Map to pixels with the axis scales, then subtract 3.5px.
- **Signature:** `markers.map(m => m.careCost.toFixed(2)).join(',')`, plus the id of the cheapest plan at the first and last sample.
- **Triggers:**

  | Situation | Behaviour |
  |---|---|
  | First results with ≥1 valid plan, chart ≥40% visible, and the sky has departed (or never ran, or the chart is out of the sky's view on mobile) | **Arrive.** Birds start in a 20px cluster just above the plot's top-right, `(plot.right − 60, plot.top − 12)`. They fly 1.3s with an attractor gliding toward `(plot.cx, plot.top + 0.3h)`. Then they land in perch-x order, left to right, 14ms apart. Done in about 2.9s, with a hard cap at 3.2s. |
  | Signature changed, 700ms after the last change | **Re-roost.** `liftOff`, fly 0.9s around the current perch centroid, then land again with the same stagger. About 2.2s. The answer card's settle wash starts at the same time. |
  | Same signature, but perches moved (premium tweak, pay-frequency change that keeps the crossovers, extent change), 250ms after the last change | **Hop.** Perched birds glide to their new perches over 350ms `--ease-out`, using a lerp in the loop. |
  | Changes arrive mid-flight | Retarget with `setPerches`. Never restart the sequence. |
  | Plot resized | Snap to the new perches. No animation. |
  | Valid plans drop to 0 | The chart unmounts, so the flock goes with it. |

- **Reduced motion:** draw the perched birds at their final positions from the first render. Every change snaps. There is never a flight, a hop or a wash.

#### `useFlockLoop` (shared by both flocks)

- Runs `requestAnimationFrame` only while something is moving, and **stops completely once everything has settled**. At rest, the page runs no animation frames.
- Cancels on `visibilitychange` to hidden. When the tab comes back, the chart flock snaps to its perches and the sky flock resumes.
- Reads layout only from `ResizeObserver` callbacks or the Recharts hooks, never per frame.
- Shows nothing before mount, so there's no hydration mismatch.
- Sets `pointer-events: none` on the flock and never takes focus.
- **Performance budget:** at most 1.5ms of script per frame at 150 birds on a 2020 laptop. If the average step time over 20 frames goes above 4ms, the loop calls `snapToPerches` (or ends the sky timeline) and stops.

`useReducedMotion()` uses `matchMedia('(prefers-reduced-motion: reduce)')` with a `change` listener. Its state is `null` until mount, so nothing renders until it's known.

```tsx
// sketch: src/components/Murmuration.tsx
export function RoostFlock({ perches, signature, plot }: { perches: { x: number; y: number }[]; signature: string;
  plot: { x: number; y: number; width: number; height: number } }) {
  const near = useRef<SVGPathElement>(null), far = useRef<SVGPathElement>(null), perched = useRef<SVGPathElement>(null);
  const reduced = useReducedMotion();
  // flock = useRef(createFlock(n, 7, …)); effects: perches/signature → schedule arrive | reroost | hop (debounced)
  // useFlockLoop(active, dt => { step(...); write paths; return !settled(flock) })
  if (reduced === null) return null;
  return <g aria-hidden="true" pointerEvents="none">
    <path ref={far} fill="var(--color-bird)" fillOpacity={0.34} />
    <path ref={near} fill="var(--color-bird)" fillOpacity={0.72} />
    <path ref={perched} fill="var(--color-bird)" fillOpacity={0.8} />
  </g>;
}
```

Add `src/flock.test.ts`, with these checks:

- The same seed gives identical paths.
- `settled()` becomes true within 200 steps of 1/60s after landing starts.
- No `NaN` appears after 10,000 steps with random perches.
- Glide paths are deterministic and finite at every wingbeat frame, including sharp turns and stalled birds.
- The share button's bird fits its 10px box.
- The sky timeline, desktop and mobile, over several seeds: the halves separate by more than 0.14w and close up again before the stream-out. It ends by the 7.5s cutoff with at most 3% of birds still flying, and those faded to 0. After `finishSky`, the nine horizon birds are perched and the rest are gone.

### D7. Copy

**Tone.** Calm, plain and reassuring, like a friend who works in benefits.

- Write in the second person, in short sentences, in the present tense.
- No exclamation marks, no urgency, no jokes.
- Never say "wrong", "bad" or "invalid" in visible copy. Say what to do next ("add Premium", "fix the highlighted fields").
- Use the real terms, capitalised as labels, and let the popovers explain them.
- Money is always `formatUsd`.
- Use colons rather than dashes.
- Don't claim certainty about the future. Say "if your care costs about…", never "you will spend".

**Fixed strings** (all in `src/copy.ts`):

- **Page title:** "Plan Finder: compare health plans by what they'd cost you"
- **`COPY.intro`:** "Plan Finder shows what each health plan would cost you over a year, from a year with no care at all to a year when you hit the limit, so you can see which plan is cheapest for the year you expect. Everything you type stays in this browser and is never sent anywhere."
- **Section heading:** "Your plans". Answer-card eyebrow: "Which plan is cheapest".
- **Pay frequency hint:** "Applies to every plan." Contribution "None" cell: "No employer money".
- **Slider "not set" hint:** "Not set. Drag the slider or type an amount to compare plans at your best guess."
- **Table caption:** "Costs at {amount} of care cost" / "Set an expected care cost to fill in the middle columns"
- **Share helper:** "Anyone with this link sees these plans. Nothing is stored on a server."
- **Chart labels:** "Expected {amount}" (marker pill) and "Below $0: you come out ahead".
- **Unchanged:** `COPY.exampleBanner`, `COPY.shareFailed` and every engine and §4 message.

**`HOW_TO_READ`** is rendered as an ordered list. It leads in with "Using the example comparison:", then:

1. "Each line is one plan. Read across for care cost, the total price of your care this year, and up for annual cost, what the year costs you in total."
2. "At $0 of care you pay only premiums: $1,200 a year for High deductible and $2,400 for Low deductible, so High deductible starts out cheaper."
3. "Each line climbs steeply while you pay the deductible, then more gently once coinsurance starts."
4. "At $3,500 of care both plans cost $4,700. That's the crossover point, marked with a ring: above it, Low deductible is cheaper."
5. "A line goes flat once that plan's out-of-pocket spend stops growing. The flat part is its worst-case cost: $6,400 for Low deductible and $11,200 for High deductible."
6. "The upright line is your expected care cost, $5,000 in the example, and the table shows each plan's cost there. Drag the slider or type an amount to try your own guess."
7. "The small birds settle along whichever line is lowest, so together they trace the cheapest plan at every care cost."

**`TERMS`** (title = `label`; these replace the §4.1 drafts and match CONTEXT.md):

| Key | Label | Body |
|---|---|---|
| `premium` | Premium | What you pay for this plan every pay period, whether or not you use any care. |
| `payFrequency` | Pay Frequency | How often premiums come out of your pay. Plan Finder multiplies each premium by the number of pay periods in a year, so pick the schedule your premiums are quoted in. |
| `annualPremium` | Annual Premium | Your premium times the number of pay periods in a year: what the plan costs before any care. |
| `deductible` | Deductible | The care cost you pay in full before the plan starts sharing costs. With a $2,000 deductible, you pay the first $2,000 of care yourself. |
| `coinsurance` | Coinsurance | After the deductible, the percentage of each bill you still pay, until you reach the OOP max. At 20%, a $1,000 bill costs you $200. It isn't a copay: copays are fixed fees, which Plan Finder doesn't include. |
| `oopMax` | OOP Max | Your out-of-pocket maximum: the most you pay for care in a year, counting the deductible and coinsurance. Once you reach it, you pay nothing more for care that year. Premiums don't count toward it. |
| `employerContribution` | Employer Contribution | Money your employer puts toward this plan each year, as an HSA or an HRA. Choose which, then enter the yearly amount, so Plan Finder can count it the right way. |
| `hsaContribution` | HSA Contribution | Health savings account money from your employer. It's yours once it's deposited, so it lowers your annual cost in full, even in a year with no care. That's why an annual cost can go below $0. |
| `hraContribution` | HRA Contribution | Health reimbursement arrangement money from your employer. It only pays you back for care you pay for, so it can't lower your annual cost by more than your out-of-pocket spend. |
| `contributionOffset` | Contribution Offset | How much the employer contribution takes off your annual cost at this care cost. An HSA always takes off its full amount; an HRA takes off up to what you've paid for care. |
| `careCost` | Care Cost | The total price of the care you get in a year, before insurance pays anything. It's the negotiated price on your bills, not what you end up paying. |
| `outOfPocketSpend` | Out-of-Pocket Spend | What you pay toward care under this plan: the deductible, then coinsurance, never more than the OOP max. Premiums are counted separately. |
| `annualCost` | Annual Cost | Your total for the year under this plan: annual premium plus out-of-pocket spend, minus any employer contribution. With an HSA it can go below $0. |
| `expectedCareCost` | Expected Care Cost | Your best guess at this year's care cost. Last year's insurance statements are a good starting point. Move the slider or type an amount to read off each plan's annual cost. |
| `worstCaseCost` | Worst-Case Cost | The most this plan can cost you in a year: your annual premium plus the most you can pay for care, minus any employer contribution. |
| `crossoverPoint` | Crossover Point | A care cost where a different plan becomes the cheapest. The chart marks each one with a ring. |
| `cheapestRange` | Cheapest Range | A span of care cost where the same plan, or plans tied together, cost the least. Each one ends at a crossover point, except the last, which runs on from there. |

### D8. Accessibility

- **Focus.** Every interactive element has a visible 2px `focus` outline at 2px offset (5.4–6.1:1 against its backgrounds). Inputs also get the 3px soft ring. Use `outline` rather than only a shadow, so focus survives `forced-colors`. Nothing removes outlines without replacing them.
- **Keyboard.** Everything is native: inputs, `<select>`, `<input type="range">` (arrows step 50), `<details>`, and popovers (Enter or Space opens, Esc closes, focus returns to the trigger). Tab order matches the visual order in both layouts, because the grid never reorders the DOM.
  - The table wrapper is one extra tab stop (`role="region"`).
  - `accessibilityLayer={false}` keeps the chart's SVG out of the tab order.
- **Labels.** Popover triggers must never sit inside a `<label>`. If they did, the input's accessible name would become "Premium per month About Premium". See D12 R1.
- **Chart.** The wrapper keeps `role="img"`, with `aria-label` set to the summary sentence. All overlays and birds are `aria-hidden`. The table is the full text equivalent.
- **Summary.** The text updates as you type, through `aria-live="polite"` (see D12 R7 on chattiness).
- **Colour.** Plan identity never relies on colour alone: there are names in the legend and table, dashes on slots 4–6, and end labels. Status always has an icon plus words. Errors are text linked with `aria-describedby`.
- **Motion.** `prefers-reduced-motion` gives static perched birds and no transitions. Flocks pause when hidden or off-screen and stop entirely once settled. Nothing animates under the pointer or while you type.
- **Touch and zoom.** Targets are at least 44px on mobile, except the 24px ⓘ, which gets 8px of clear space around it. Inputs are 16px. Layouts reflow at 320px wide and at 200% zoom with no horizontal page scroll (Q25).

### D9. Build notes for the implementer

- Apply the tokens and fonts in step 7 rather than step 11. Step 11 is then the motion and overlay pass: `flock.ts`, `Murmuration.tsx` and `ChartOverlays.tsx`.
- Inline SVG icons go in a single `src/components/icons.tsx`: info, close, plus, link, check, alert, ring and three-birds. Keep each to a few paths. There is no icon library.
- With reduced motion, check that Q1–Q26 still pass. The birds must not add any `.recharts-line` or `.recharts-reference-dot`.

### D10. Decisions this design takes

- Light theme only. Fonts are Atkinson Hyperlegible Next and Newsreader, self-hosted through `next/font/local`.
- Plan colours are by position, slots 4–6 are dashed, there is no red, and the palette is validated.
- The answer card is the hero, and its live block is sticky on tall desktops only.
- Chart lines never animate. The birds are the only motion with meaning, and they always come to rest.

### D11. What's not in v1

Dark mode, a chart tooltip (decision 12), a motion on/off toggle (the OS setting is enough), print styles, and pointer-reactive birds.

### D12. Changes to other sections (approved)

All of R1–R8 are approved, along with applying the theme tokens and fonts in step 7 instead of step 11. Where they conflict with §1, §3.4, §4, §6 or §7, they take precedence.

- **R1 (`Term`, a11y).** Add an optional `htmlFor?: string` to `Term` and have it render `<label htmlFor>` followed by `InfoPopover` as siblings, so the label text and the trigger aren't nested. `PayFrequencySelect` and `PlanCard` use it. Table headers can keep the nested form.
- **R2 (colours by position).** `Results` receives only `valid`, so it can't look up `PLAN_COLORS[index]`. Add `colors: string[]`, aligned with `valid`, to the `Results` and `BreakdownTable` props. `PlanFinder` computes it from each valid plan's index.
- **R3 (chart label).** `ResultsChart` needs the summary sentence for its `aria-label`, but its props don't include it. Either add a `label: string` prop, or have `Results` render the `role="img"` / `data-testid="cost-chart"` wrapper.
- **R4 (files).** Add `src/planStyle.ts`, `src/flock.ts` with `flock.test.ts`, `src/components/Murmuration.tsx`, `ChartOverlays.tsx`, `icons.tsx` and `src/app/fonts/` to the §1 layout.
- **R5 (contribution amount label).** Name it in §4: "HSA Contribution per year" or "HRA Contribution per year".
- **R6 (notice lifetime).** §3.4 should say the share-failed notice clears on the first edit.
- **R7 (live region).** Consider a visually hidden live region that announces the sentence 700ms after typing stops, and make the visible `cheapest-summary` non-live. Every keystroke currently queues an announcement.
- **R8 (QA).** Add checks for:
  - Reduced motion: no rAF after load, birds perched statically.
  - The rAF loop being idle after settling, which can be checked with a `performance` trace or a counter.
  - The scroll region's tab stop in Q22.
  - `CareCostSlider max = extent`.

## 6. Verification plan (QA)

### 6.1 Automated gates (all must exit 0)

```
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test                      # all §5 cases present and passing
bun run build                 # produces out/index.html; no server routes
grep -rEn "from ['\"](react|next|recharts)" src/engine src/share src/*.ts   # no output
```

Also confirm `out/` has no `.rsc`-only routes and no API folders, and that `next.config.ts` contains `output: 'export'`.

### 6.2 Browser checks with playwright-cli

Serve with `bun run preview` in the background, then use `http://localhost:4173/`. Start each numbered check from a clean session unless it says otherwise (`playwright-cli -s=<name> open …`, `localstorage-clear`). Use `snapshot` to get refs. Use `eval` to read text, for example `document.querySelector('[data-testid=cheapest-summary]').textContent`.

| # | Steps | Expected observable outcome |
|---|---|---|
| Q1 | Fresh session, open `/` | Intro visible. Example banner visible. Two plan cards, "Low deductible" and "High deductible". Pay Frequency shows Monthly. Summary is exactly "High deductible is cheapest up to $3,500 of care cost; Low deductible is cheapest from $3,500 on." Chart has 2 `.recharts-line`, 1 `.recharts-reference-dot`, and 1 vertical reference line at expected care cost. `localstorage-get plan-finder:comparison` is empty. |
| Q2 | Q1, read the breakdown table | Low deductible: $2,400, $2,600, $0, $5,000, $6,400, marked Cheapest. High deductible: $1,200, $5,000, $0, $6,200, $11,200. |
| Q3 | Fill High deductible Premium with `150` | Without blur or submit, the summary becomes "…up to $2,750 of care cost; Low deductible is cheapest from $2,750 on." High row: $1,800, $5,000, $0, $6,800, $11,800. Example banner is gone. URL has no fragment. localStorage key now set. |
| Q4 | Fill Low deductible OOP Max with `1000` (below its $2,000 deductible) | That card shows "OOP Max can't be less than the deductible" next to the field (`aria-invalid=true`) and "Not charted…". Chart has 1 line. `not-charted` reads "Not charted: Low deductible (invalid)." The value stays `1000` (not corrected). Summary is the single-plan sentence. |
| Q5 | Clear the Premium of a plan | Card says "Not charted yet: add Premium." `not-charted` lists it as "(incomplete)". |
| Q6 | Click "Add plan" 4 times | 6 cards, named Plan A–D (or the next unused names), coinsurance prefilled `20`. Focus is in the new card's name input. "Add plan" is disabled and "Up to 6 plans" shows. New blank plans are listed as incomplete. |
| Q7 | Remove plans until 1 remains | Remove buttons disappear at 1 plan. Focus is on "Add plan". |
| Q8 | Rename "High deductible" to "Bronze" | Legend, summary and table update to "Bronze" live. |
| Q9 | Fresh session, example; select Pay Frequency "Annual" | Premium labels read "Premium per year". Summary crossover is $2,125. Table at $5,000: Low has Annual Premium $200 and Annual Cost $2,800 (worst case $4,200); High has $100 and $5,100 (worst case $10,100). |
| Q10 | Select "Weekly" | Crossover $18,000. Table: Low annual cost $13,000, High $10,200 (High is Cheapest). |
| Q11 | Select "Semi-monthly" | Crossover $5,000. At $5,000 both rows show $7,400 and **both** are marked Cheapest. |
| Q12 | Fresh example. Type `16000` into "Expected Care Cost amount" | Slider moves. Marker moves. Low annual cost $6,400, High $10,000. Type `-5`: the error "Enter an amount of $0 or more" shows and the values don't change. Clear it: care-dependent cells show "—" and the marker disappears; the Worst-Case column stays. |
| Q13 | Add plan C: 150 / 3000 / 20 / 6000, Employer Contribution HSA, 1000 | Summary "C is cheapest up to $16,000 of care cost; Low deductible is cheapest from $16,000 on." (using C's name). At $5,000 the C row shows $1,800, $3,400, -$1,000, $4,200, $6,800. |
| Q14 | Change C's contribution to HRA | Summary has three parts: High deductible up to $600; C from $600 to $16,000; Low deductible from $16,000 on. Set expected care cost to `300`: C offset -$300, C annual cost $1,800; High is Cheapest ($1,500). |
| Q15 | HSA 3000 on C, expected care cost `0` | The C annual cost is shown as negative (-$1,200). The chart y-axis extends below 0 with a zero line. |
| Q16 | Share round-trip: in session S1 make the Q13 comparison, set Weekly, click "Copy share link", read the "Share link" input value | Value matches `http://localhost:4173/#c=1.` followed by base64url. Open the URL in a new session S2 (empty storage). Same plans, names, values, frequency, expected care cost, summary and table. No example banner. S2's `localstorage-get plan-finder:comparison` is empty. |
| Q17 | Auto-save survives reload: S1 after edits, `reload` (no fragment) | Same comparison restored. No example banner. |
| Q18 | No clobber: S3 with auto-save X (edit the example premium to 150, then reload to confirm). `goto` the Q16 share URL. | Share comparison Y shown. `localstorage-get` still decodes to X (value unchanged byte-for-byte). `goto /` shows X. `goto` the share URL again and edit any field: the fragment is removed from the URL and localStorage now holds the edited Y. Reload shows the edited Y. |
| Q19 | Bad share link: `goto /#c=1.garbage!!` in a fresh session; then in a session with an auto-save | Fresh: example plus notice "…an example comparison instead." With auto-save: auto-save plus "…your last comparison instead." No console errors. `goto /#c=2.abcd` behaves the same way. |
| Q20 | Hash change in an open tab: from the example, `goto` the Q16 URL in the same tab | The comparison switches to the shared one without a manual reload. |
| Q21 | Popovers: click each ⓘ button (Premium, Pay Frequency, Deductible, Coinsurance, OOP Max, Employer Contribution, the table headers, Expected Care Cost) | The popover opens showing the matching `TERMS` copy. `press Escape` closes it and focus returns to the button. Clicking outside closes it. |
| Q22 | Keyboard only: `press Tab` through the page from the top | Reaches every input, select, ⓘ button, Add/Remove, slider, "How to read this chart" summary and Copy share link, in visual order, with a visible focus ring. Enter or Space opens a popover and toggles the details. On the slider, ArrowRight from $5,000 gives $5,050 and the table updates. "Start with a blank plan" works by keyboard. |
| Q23 | "How to read this chart" | Collapsed by default. Opens on click. Mentions $3,500 and $4,700. |
| Q24 | "Start with a blank plan" from the example | One plan "Plan A", fields blank except coinsurance 20, monthly. Summary shows the fill-in message. No chart. localStorage is set. |
| Q25 | Mobile: `resize 375 812`, reload the example | `eval document.documentElement.scrollWidth <= window.innerWidth` is true. Cards stack in one column. Chart is visible with non-zero height. The table scrolls inside its wrapper. All controls are reachable and tappable. |
| Q26 | Console: run `playwright-cli console` after Q1–Q25 in each session | No errors or warnings: no hydration mismatch, no Recharts width/height warning, no React key warnings. |
| Q27 | Network: `playwright-cli network` after a share-link load | No request carries plan data (only static assets, all from localhost). |

Q9 values: Low deductible: Annual Premium $200, Out-of-Pocket Spend $2,600, Annual Cost $2,800, Worst-Case $4,200. High deductible: $100, $5,000, $5,100, $10,100. Summary crossover $2,125.

## 7. Implementation steps

Work test-first for steps 2–6. Each step must pass its done-check before the next one starts.

| Step | Work | Done-check |
|---|---|---|
| 1 | Scaffold by hand (§1): config files, `src/app/layout.tsx` and `page.tsx` with an "Plan Finder" heading, `bun install` | `bun run typecheck`, `bun run lint` and `bun run build` pass; `out/index.html` exists; `bun.lock` committed to the tree |
| 2 | `engine/types.ts`, `engine/validate.ts` (tests V1–V16 first) | `bun test src/engine/validate.test.ts` green |
| 3 | `engine/cost.ts` (C1–C15) | green |
| 4 | `engine/envelope.ts` (R1–R19) | green; no React/Next imports (the lint purity rule passes) |
| 5 | `engine/chart.ts` (G1–G8); `format.ts`, `summary.ts`, `comparison.ts` (F, S, M) | green |
| 6 | `share/codec.ts`, `storage.ts`, `load.ts` (K1–K10, P1–P2, L1–L5); pin the K6 golden string | green; `bun test` overall green |
| 7 | App shell: `copy.ts` (`TERMS` complete), `Term`, `InfoPopover`, `PlanFinder` (state, load-on-mount, `update`, auto-save effect, hashchange), `PlanCard`, `PayFrequencySelect`, `ExampleBanner`, share-failed notice | `bun run build` passes; manual dev check: the example loads, editing shows validation messages, add/remove works up to 6 |
| 8 | Results: `Results`, `CheapestSummary`, `ResultsChart`, `CareCostSlider`, `BreakdownTable` | Q1–Q15 pass by hand in `bun run dev`; no console warnings |
| 9 | `ShareButton`, the fragment-strip on first edit, the no-clobber rule end-to-end | Q16–Q20 pass |
| 10 | Copy: `Intro`, `HowToRead`, final popover text; focus management on add/remove | Q21–Q24 pass |
| 11 | Design pass, per the Design section | Q25–Q26 pass; all §6.1 gates still pass |
| 12 | Full QA run: §6.1 gates, then Q1–Q27 against `bun run build && bun run preview` | All pass; report any failures with the check number |

### Critical files for implementation

- /Users/danieldolan/Projects/plan-finder/src/engine/envelope.ts
- /Users/danieldolan/Projects/plan-finder/src/engine/cost.ts
- /Users/danieldolan/Projects/plan-finder/src/share/codec.ts
- /Users/danieldolan/Projects/plan-finder/src/components/PlanFinder.tsx
- /Users/danieldolan/Projects/plan-finder/src/copy.ts

---

**Correction to fold in when saving:** the Q9 row has a stray self-correction in its middle cell. Replace that cell with: "Premium labels read 'Premium per year'. Summary crossover is $2,125. Table at $5,000: Low deductible $200 / $2,600 / $0 / $2,800 / $4,200; High deductible $100 / $5,000 / $0 / $5,100 / $10,100." The line after the table already has the correct numbers, so it can then be dropped.

**About the numbers:**
- **The example comparison:** one crossover at $3,500, where both plans cost $4,700. High deductible is cheapest from $0 to $3,500 and Low deductible from $3,500 on.
- **Checked by calculation:** the crossovers for the other pay frequencies (weekly $18,000, biweekly $5,250, semi-monthly $5,000 with a tie, annual $2,125), the HSA and HRA third-plan scenarios, the six-plan staircase, and the touching, overlap, half-cent and three-lines-through-one-point cases.

**Before scaffolding:** `create-next-app` won't run in this folder because `CONTEXT.md` is already there, so step 1 sets the project up by hand.

**Your call:** section 0 lists choices the docs leave open, such as treating a blank coinsurance field as incomplete and adding an extra breakpoint for HRA plans. Override any of them before the implementer starts.
