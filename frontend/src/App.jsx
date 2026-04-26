import { Suspense, lazy } from 'react';
import { Hero } from './components/layout/Hero';
import { NavBar } from './components/layout/NavBar';
import { ChatPlayground } from './components/chat/ChatPlayground';

const FeatureGrid = lazy(() =>
  import('./components/layout/FeatureGrid').then((mod) => ({ default: mod.FeatureGrid })),
);
const PerformanceStrip = lazy(() =>
  import('./components/layout/PerformanceStrip').then((mod) => ({ default: mod.PerformanceStrip })),
);

function SectionSkeleton() {
  return <div className="section-skeleton" aria-hidden="true" />;
}

export default function App() {
  return (
    <div className="app-shell">
      <NavBar />
      <main>
        <Hero />
        <ChatPlayground />
        <Suspense fallback={<SectionSkeleton />}>
          <FeatureGrid />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <PerformanceStrip />
        </Suspense>
      </main>
    </div>
  );
}
