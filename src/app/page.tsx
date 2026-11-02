import { Intro } from '@/components/Intro';
import { PlanFinder } from '@/components/PlanFinder';

export default function Page() {
  return (
    <>
      <Intro />
      <main className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6">
        <PlanFinder />
      </main>
    </>
  );
}
