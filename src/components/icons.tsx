// Inline stroke icons, decorative only.
const svg = (size: number, className: string | undefined, children: React.ReactNode, opts: { fill?: boolean; box?: number; stroke?: number } = {}) => (
  <svg
    width={size}
    height={size}
    viewBox={`0 0 ${opts.box ?? 16} ${opts.box ?? 16}`}
    fill={opts.fill ? 'currentColor' : 'none'}
    stroke={opts.fill ? 'none' : 'currentColor'}
    strokeWidth={opts.stroke ?? 1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    {children}
  </svg>
);
type P = { className?: string };

export const InfoIcon = ({ className }: P) =>
  svg(16, className, <><circle cx="8" cy="8" r="6.5" strokeWidth={1.5} /><path d="M8 7.2v4M8 4.9v.1" strokeWidth={1.5} /></>);
export const CloseIcon = ({ className }: P) => svg(16, className, <path d="M4 4l8 8M12 4l-8 8" />);
export const PlusIcon = ({ className }: P) => svg(16, className, <path d="M8 3v10M3 8h10" />);
export const LinkIcon = ({ className }: P) =>
  svg(16, className, <path d="M6.6 9.4a2.8 2.8 0 0 0 4 0l2.2-2.2a2.8 2.8 0 0 0-4-4l-.7.7M9.4 6.6a2.8 2.8 0 0 0-4 0L3.2 8.8a2.8 2.8 0 0 0 4 4l.7-.7" />);
export const CheckIcon = ({ className }: P) => svg(16, className, <path d="M3.5 8.5l3 3 6-7" />);
export const AlertIcon = ({ className }: P) =>
  svg(14, className, <><circle cx="8" cy="8" r="6.5" strokeWidth={1.5} /><path d="M8 4.6v4.2M8 11.3v.1" strokeWidth={1.6} /></>);
export const RingIcon = ({ className }: P) => svg(12, className, <circle cx="8" cy="8" r="5.5" strokeWidth={2} />);
export const ChevronIcon = ({ className }: P) => svg(16, className, <path d="M6 3.5L10.5 8 6 12.5" />);

/** One perched starling, the same silhouette as the chart's roosting birds. */
export const PerchedBirdIcon = ({ className }: P) =>
  svg(12, className, <path d="M2.5 9.5Q5 5.5 9.5 6Q13 6.3 13.5 8.6Q11 11.5 6.5 10.6L1.5 12.5Z" />, { fill: true });

export const ThreeBirdsIcon = ({ className }: P) =>
  svg(20, className, <path d="M2 8.5l2.5-1.8L7 8.5M8.5 4.5l2.5-1.8 2.5 1.8M11 12.5l2.7-2 2.8 2" />, { box: 20, stroke: 1.3 });
