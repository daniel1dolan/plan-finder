# Plan Finder v1 plan

Settled in a grilling session on 2026-11-01. Vocabulary lives in [`CONTEXT.md`](../CONTEXT.md); the architecture decision is in [ADR 0001](adr/0001-static-export-browser-only-state.md).

## Scope

- **Plan entry**: 1–6 named plans. Fields: premium, deductible, coinsurance (prefilled 20%), OOP max, and an optional HSA or HRA employer contribution. One pay-frequency selector per comparison (default monthly).
- **Results**, updated live as you type:
  - Line chart of annual cost (y) against care cost (x), one line per plan, with crossover points marked. The x-axis runs from $0 to past the point where every plan has hit its OOP max; the y-axis allows negative values (HSA).
  - A cheapest-range summary sentence, including ties ("Plans A and B are tied at $6,400").
  - An expected-care-cost slider, with a vertical marker and a breakdown table: annual premium, out-of-pocket spend, contribution offset, annual cost, worst-case cost.
- **Validation**: incomplete and invalid plans are listed but not charted, and values are never silently corrected.
- **Persistence**: auto-save to local storage, plus a share link in the URL fragment (`/#c=...`) carrying a versioned payload. Load order: share link → auto-save → example comparison.
- **Explanation**: a short intro above the tool, an info popover on every term, and a collapsible "How to read this chart" that walks through the example.

## Stack

Next.js with `output: 'export'`, Bun, Tailwind, and Recharts. The cost engine is pure TypeScript with no React or Next imports, tested with `bun test`.

## Build order

1. **Cost engine, test-first**: `validatePlan`, `annualPremium`, `outOfPocketSpend`, `annualCost` (HSA/HRA branches), plan breakpoints, `cheapestRanges` / `crossoverPoints` (exact, using the piecewise-linear segments; ties within half a cent).
2. **Share-link codec**: a versioned encode/decode of a comparison, round-trip tested.
3. **App shell**: a static-export Next.js app with plan forms and the pay-frequency selector, wired to the engine.
4. **Results**: chart, summary sentence, slider, and breakdown table.
5. **Persistence and the example comparison**, following the load order.
6. **Copy**: intro, popovers, and the chart walkthrough.

## Assumptions (not explicitly discussed)

- US plans and USD only. Deductible, coinsurance and OOP max are US-specific concepts.
- Desktop-first, but usable on a phone, since people often check benefits on mobile.
