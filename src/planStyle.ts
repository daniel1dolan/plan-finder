// Colour comes from a plan's position, so a plan keeps its colour when another stops being charted.
// Slots 4-6 are dashed: no six colours separate every pair under colour-blindness.
export const PLAN_COLORS = ['#2F6DB5', '#B0670F', '#A24D8F', '#5F7F1A', '#6A5BC4', '#168A6C'] as const;
export const PLAN_DASHES = [undefined, undefined, undefined, '9 4', '0.5 5', '12 4 2 4'] as const;
export const dashFor = (color: string) => PLAN_DASHES[PLAN_COLORS.indexOf(color as never)];
