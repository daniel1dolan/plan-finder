import { COPY, type ShareFallback } from '@/copy';
import { InfoIcon, ThreeBirdsIcon } from './icons';

const shell = 'flex flex-col gap-3 rounded-lg border px-[18px] py-[14px] sm:flex-row sm:items-center lg:col-span-2';

export function ExampleBanner({ onStartFresh }: { onStartFresh: () => void }) {
  return (
    <div className={`${shell} border-[#CFD8D5] bg-dawn`}>
      <p className="flex flex-1 items-start gap-3 text-ink">
        <ThreeBirdsIcon className="mt-0.5 shrink-0 text-bird opacity-70" />
        {COPY.exampleBanner}
      </p>
      <button type="button" onClick={onStartFresh} className="btn btn-secondary shrink-0">
        {COPY.startFresh}
      </button>
    </div>
  );
}

export function ShareFailedNotice({ fallback }: { fallback: ShareFallback }) {
  return (
    <div role="status" className={`${shell} border-hairline bg-notice-wash`}>
      <p className="flex flex-1 items-start gap-3 text-ink">
        <InfoIcon className="mt-1 shrink-0 text-ink-2" />
        {COPY.shareFailed(fallback)}
      </p>
    </div>
  );
}
