// All user-facing explanatory copy. Labels are the CONTEXT.md terms; bodies explain them plainly.

export const TERMS = {
  premium: {
    label: 'Premium',
    body: 'What you pay for this plan every pay period, whether or not you use any care.',
  },
  payFrequency: {
    label: 'Pay Frequency',
    body: 'How often premiums come out of your pay. Plan Finder multiplies each premium by the number of pay periods in a year, so pick the schedule your premiums are quoted in.',
  },
  annualPremium: {
    label: 'Annual Premium',
    body: 'Your premium times the number of pay periods in a year: what the plan costs before any care.',
  },
  deductible: {
    label: 'Deductible',
    body: 'The care cost you pay in full before the plan starts sharing costs. With a $2,000 deductible, you pay the first $2,000 of care yourself.',
  },
  coinsurance: {
    label: 'Coinsurance',
    body: "After the deductible, the percentage of each bill you still pay, until you reach the OOP max. At 20%, a $1,000 bill costs you $200. It isn't a copay: copays are fixed fees, which Plan Finder doesn't include.",
  },
  oopMax: {
    label: 'OOP Max',
    body: "Your out-of-pocket maximum: the most you pay for care in a year, counting the deductible and coinsurance. Once you reach it, you pay nothing more for care that year. Premiums don't count toward it.",
  },
  employerContribution: {
    label: 'Employer Contribution',
    body: 'Money your employer puts toward this plan each year, as an HSA or an HRA. Choose which, then enter the yearly amount, so Plan Finder can count it the right way.',
  },
  hsaContribution: {
    label: 'HSA Contribution',
    body: "Health savings account money from your employer. It's yours once it's deposited, so it lowers your annual cost in full, even in a year with no care. That's why an annual cost can go below $0.",
  },
  hraContribution: {
    label: 'HRA Contribution',
    body: "Health reimbursement arrangement money from your employer. It only pays you back for care you pay for, so it can't lower your annual cost by more than your out-of-pocket spend.",
  },
  contributionOffset: {
    label: 'Contribution Offset',
    body: "How much the employer contribution takes off your annual cost at this care cost. An HSA always takes off its full amount; an HRA takes off up to what you've paid for care.",
  },
  careCost: {
    label: 'Care Cost',
    body: "The total price of the care you get in a year, before insurance pays anything. It's the negotiated price on your bills, not what you end up paying.",
  },
  outOfPocketSpend: {
    label: 'Out-of-Pocket Spend',
    body: 'What you pay toward care under this plan: the deductible, then coinsurance, never more than the OOP max. Premiums are counted separately.',
  },
  annualCost: {
    label: 'Annual Cost',
    body: 'Your total for the year under this plan: annual premium plus out-of-pocket spend, minus any employer contribution. With an HSA it can go below $0.',
  },
  expectedCareCost: {
    label: 'Expected Care Cost',
    body: "Your best guess at this year's care cost. Last year's insurance statements are a good starting point. Move the slider or type an amount to read off each plan's annual cost.",
  },
  worstCaseCost: {
    label: 'Worst-Case Cost',
    body: 'The most this plan can cost you in a year: your annual premium plus the most you can pay for care, minus any employer contribution.',
  },
  crossoverPoint: {
    label: 'Crossover Point',
    body: 'A care cost where a different plan becomes the cheapest. The chart marks each one with a ring.',
  },
  cheapestRange: {
    label: 'Cheapest Range',
    body: 'A span of care cost where the same plan, or plans tied together, cost the least. Each one ends at a crossover point, except the last, which runs on from there.',
  },
} satisfies Record<string, { label: string; body: string }>;
export type TermKey = keyof typeof TERMS;

/** What a broken share link fell back to: on load, the auto-save or the example; in an open tab, what was there. */
export type ShareFallback = 'autosave' | 'example' | 'kept';

export const COPY = {
  title: "Plan Finder: compare health plans by what they'd cost you",
  intro:
    'Plan Finder shows what each health plan would cost you over a year, from a year with no care at all to a year when you hit the limit, so you can see which plan is cheapest for the year you expect. Everything you type stays in this browser and is never sent anywhere.',
  yourPlans: 'Your plans',
  answerEyebrow: 'Which plan is cheapest',
  payFrequencyHint: 'Applies to every plan.',
  noContribution: 'No employer money',
  exampleBanner: 'This is an example comparison. Change any number to make it yours, or start with a blank plan.',
  startFresh: 'Start with a blank plan',
  shareFailed: (fallback: ShareFallback) =>
    fallback === 'kept'
      ? "That share link couldn't be opened, so we kept the comparison you had open."
      : `That share link couldn't be opened, so we loaded ${fallback === 'autosave' ? 'your last comparison' : 'an example comparison'} instead.`,
  sliderNotSet: 'Not set. Drag the slider or type an amount to compare plans at your best guess.',
  sliderError: 'Enter an amount of $0 or more',
  sliderTooBig: 'Enter an amount up to $1,000,000,000',
  tableCaption: (amount: string | null) =>
    amount === null ? 'Set an expected care cost to fill in the middle columns' : `Costs at ${amount} of care cost`,
  shareHelper: 'Anyone with this link sees these plans. Nothing is stored on a server.',
  belowZero: 'Below $0: you come out ahead',
  maxPlansHint: 'Up to 6 plans',
};

export const HOW_TO_READ_LEAD = 'Using the example comparison:';
export const HOW_TO_READ = [
  'Each line is one plan. Read across for care cost, the total price of your care this year, and up for annual cost, what the year costs you in total.',
  'At $0 of care you pay only premiums: $1,200 a year for High deductible and $2,400 for Low deductible, so High deductible starts out cheaper.',
  'Each line climbs steeply while you pay the deductible, then more gently once coinsurance starts.',
  "At $3,500 of care both plans cost $4,700. That's the crossover point, marked with a ring: above it, Low deductible is cheaper.",
  "A line goes flat once that plan's out-of-pocket spend stops growing. The flat part is its worst-case cost: $6,400 for Low deductible and $11,200 for High deductible.",
  'The upright line is your expected care cost, $5,000 in the example, and the table shows each plan\'s cost there. Drag the slider or type an amount to try your own guess.',
  'The small birds settle along whichever line is lowest, so together they trace the cheapest plan at every care cost.',
];
