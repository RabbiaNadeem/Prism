import { useMemo } from 'react';

const ITEMS = [
  { label: 'Code Split Sections', value: '2 lazy blocks' },
  { label: 'Dependency Weight', value: 'React + Vite only' },
  { label: 'Network Calls', value: 'Single API path' },
];

export function PerformanceStrip() {
  const stats = useMemo(() => ITEMS, []);

  return (
    <section id="performance" className="panel perf-strip">
      {stats.map((item) => (
        <div key={item.label}>
          <p>{item.label}</p>
          <strong>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}
