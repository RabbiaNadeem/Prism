import { Suspense, lazy } from 'react';
import { NavBar } from './components/layout/NavBar';
import { ChatPlayground } from './components/chat/ChatPlayground';

const FeatureGrid = lazy(() =>
  import('./components/layout/FeatureGrid').then((mod) => ({ default: mod.FeatureGrid })),
);

function SectionSkeleton() {
  return <div className="section-skeleton" aria-hidden="true" />;
}

export default function App() {
  return (
    <div className="app-shell">
      <NavBar />
      <main>
        <ChatPlayground />
        <Suspense fallback={<SectionSkeleton />}>
          <FeatureGrid />
        </Suspense>
      </main>
    </div>
  );
}
