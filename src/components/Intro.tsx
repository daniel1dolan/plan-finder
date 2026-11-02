import { COPY } from '@/copy';
import { SkyMurmuration } from './Murmuration';

export function Intro() {
  return (
    <header className="relative mb-8">
      <div
        className="absolute inset-x-0 top-0 h-24 border-b border-axis sm:h-[180px]"
        style={{ background: 'linear-gradient(180deg, var(--color-firstlight) 0%, #EEF0EB 55%, var(--color-mist) 100%)' }}
      >
        <SkyMurmuration className="absolute inset-y-0 right-0 h-full w-full sm:w-[55%]" />
      </div>
      {/* Mobile: the title sits below the 96px band. Desktop: inside the 180px band, left of the flock. */}
      <div className="relative mx-auto max-w-[1200px] px-4 pt-[112px] sm:px-6 sm:pt-[100px]">
        <h1 className="font-serif text-[34px] leading-[38px] font-medium tracking-[-0.01em] sm:text-[44px] sm:leading-[48px]">Plan Finder</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] leading-[26px] text-ink-2 sm:mt-12 sm:text-[18px] sm:leading-7">{COPY.intro}</p>
      </div>
    </header>
  );
}
