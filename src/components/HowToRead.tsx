import { HOW_TO_READ, HOW_TO_READ_LEAD } from '@/copy';
import { ChevronIcon } from './icons';

export function HowToRead() {
  return (
    <details className="how-to-read">
      <summary className="flex h-11 cursor-pointer items-center gap-2 rounded-md text-[15px] font-semibold text-ink">
        <ChevronIcon className="chevron" />
        How to read this chart
      </summary>
      <div className="rounded-lg bg-paper px-5 py-4 text-[15px] leading-6 text-ink-2">
        <p className="mb-2">{HOW_TO_READ_LEAD}</p>
        <ol className="list-decimal space-y-2 pl-5">
          {HOW_TO_READ.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>
    </details>
  );
}
