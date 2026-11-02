# Plan Finder

A tool for comparing health insurance plans by showing what each one costs you across the range of medical spending you might have in a year, so you can see where one plan stops being the better deal.

## Language

These terms are also the UI labels: the screen shows the real term (e.g. "Deductible", "Out-of-Pocket Max", "Care Cost"), with an info popover explaining it in plain words. The popover copy lives in one module, so there's no separate set of "friendly" labels.

### Plans

**Plan**:
One health insurance option being compared, defined by its premium, deductible, coinsurance, OOP max, and employer contribution.
_Avoid_: Policy, option, tier

**Premium**:
The fixed amount you pay for a plan each pay period, regardless of whether you use any care.
_Avoid_: Payroll deduction, contribution

**Incomplete Plan**:
A plan missing a required field (premium, deductible, or OOP max); it is listed but not charted.
_Avoid_: Draft, empty plan

**Invalid Plan**:
A plan whose fields contradict each other (e.g. OOP max below deductible); it is listed with an error but not charted.
_Avoid_: Broken plan, bad plan

**Pay Frequency**:
How often premiums are charged (weekly, biweekly, semi-monthly, monthly, or annual); one setting per comparison, defaulting to monthly.
_Avoid_: Pay period, billing cycle

**Annual Premium**:
A plan's premium multiplied by the number of pay periods in a year for the comparison's pay frequency.

**Deductible**:
The amount of care cost you pay in full before the plan starts sharing costs.

**Coinsurance**:
The percentage of care cost above the deductible that you pay, until the OOP max is reached.
_Avoid_: Copay (a copay is a fixed per-visit fee, which v1 does not model)

**OOP Max**:
The most you pay in deductible plus coinsurance in a year; it includes the deductible and excludes premiums.
_Avoid_: Out-of-pocket limit, MOOP, cap

**Employer Contribution**:
An optional yearly amount the employer provides with a plan, as either an HSA or HRA contribution, which offsets your annual cost.
_Avoid_: Employer match, seed money

**HSA Contribution**:
An employer contribution that becomes your money once deposited, so it offsets annual cost in full even if you use no care.
_Avoid_: Health savings, HSA match

**HRA Contribution**:
An employer contribution that only reimburses care you pay for, so it offsets annual cost by at most your out-of-pocket spend.
_Avoid_: Reimbursement account, allowance

**Comparison**:
A set of plans evaluated together, sharing one pay frequency and one expected care cost.
_Avoid_: Scenario, analysis, session

**Example Comparison**:
A prefilled comparison shown to a first-time visitor, to demonstrate the tool before they enter their own plans.
_Avoid_: Demo, sample data, default plans

**Share Link**:
A URL that encodes an entire comparison, so opening it reproduces that comparison with no server involved.
_Avoid_: Permalink, export, saved comparison

### Costs

**Care Cost**:
The total negotiated price of the medical care you receive in a year, before insurance pays anything.
_Avoid_: Medical expenses, billed amount, usage, claims

**Out-of-Pocket Spend**:
What you pay toward care cost under a plan: deductible plus coinsurance, capped at the OOP max.
_Avoid_: Out-of-pocket cost (ambiguous with Annual Cost)

**Annual Cost**:
Your total yearly cost under a plan for a given care cost: annual premium + out-of-pocket spend − the offset from its employer contribution; it can be negative.
_Avoid_: Total cost, net cost, true cost

**Crossover Point**:
A care cost at which the set of cheapest plans changes.
_Avoid_: Break-even, tipping point

**Cheapest Range**:
A span of care cost over which the same plan, or set of tied plans, has the lowest annual cost; the last range is open-ended.
_Avoid_: Winning range, sweet spot

**Expected Care Cost**:
The user's single best guess at their care cost for the year, used to read off each plan's annual cost.
_Avoid_: Estimated usage, scenario

**Worst-Case Cost**:
A plan's annual cost once out-of-pocket spend has reached the OOP max; the most that plan can cost in a year.
_Avoid_: Max cost, ceiling

## Relationships

- A **Plan** maps every **Care Cost** to exactly one **Out-of-Pocket Spend** and one **Annual Cost**
- **Out-of-Pocket Spend** = min(**OOP Max**, min(care, **Deductible**) + **Coinsurance** × max(0, care − **Deductible**))
- A **Plan** has zero or one **Employer Contribution**, which is either an **HSA Contribution** or an **HRA Contribution**
- **Annual Cost** = **Annual Premium** + **Out-of-Pocket Spend** − offset, where the offset is the full **HSA Contribution**, or min(**HRA Contribution**, **Out-of-Pocket Spend**)
- Only complete, valid **Plans** take part in the chart, **Crossover Points**, and **Cheapest Ranges**; input is never silently clamped or corrected
- A new **Plan**'s **Coinsurance** is prefilled at 20%; 0% and 100% are valid
- **Crossover Points** split the care-cost axis into **Cheapest Ranges**, each owned by one or more tied **Plans**
- Two **Annual Costs** within half a cent are equal; lines that touch without changing the cheapest set make no **Crossover Point**
- A **Comparison** has one to six named **Plans**, exactly one **Pay Frequency**, and at most one **Expected Care Cost**
- A **Share Link** encodes exactly one **Comparison**; the browser also auto-saves the current **Comparison** locally
- On load, the **Comparison** comes from the **Share Link**, else the auto-save, else the **Example Comparison**; opening a **Share Link** doesn't overwrite the auto-save until the user edits
- A **Plan** is priced for one coverage tier; the same insurance product at two tiers is two **Plans**

## Example dialogue

> **Dev:** "If my care cost is $5,000, what's my out-of-pocket spend on the $2,000-deductible, 20% coinsurance plan?"
> **Domain expert:** "$2,000 plus 20% of the remaining $3,000, so $2,600, as long as that's under the OOP max. Add premiums and subtract the employer contribution to get the annual cost."

## Flagged ambiguities

- "Medical expenses" in the original idea meant **Care Cost** (pre-insurance price), not what you pay. Resolved: the x-axis is **Care Cost**.
- "Employer contribution" was first treated as one number subtracted in full. Resolved: an **HRA Contribution** is capped at out-of-pocket spend, so it has to be distinguished from an **HSA Contribution**.
- "Crossover point" first meant "where two lines cross." Resolved: lines can touch without changing the winner, or overlap for an open-ended span, so a **Crossover Point** is only where the cheapest set changes.
- "Out of pocket" was used both for the cap and for what you pay. Resolved: **OOP Max** is the cap; **Out-of-Pocket Spend** is what you pay.

## Out of scope (v1)

- Copays, in-network vs out-of-network splits, and family/embedded deductibles.
- Coverage tiers (employee only, +spouse, family) as a modelled concept; the user enters the numbers for the tier they're buying.
- Multiple named saved comparisons; there is one current comparison, and share links serve as bookmarks.
- Tax savings on the user's own HSA/FSA contributions; they depend on personal tax data.
- Probability/risk modelling of care cost; **Expected Care Cost** is a single number, and **Worst-Case Cost** covers the tail.
