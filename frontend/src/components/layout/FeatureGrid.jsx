const FEATURES = [
  {
    title: 'Provider Failover',
    detail: 'Routes across supported providers and keeps responses OpenAI-compatible.',
  },
  {
    title: 'Secure Access',
    detail: 'Use API keys safely with immediate validation and clear status feedback.',
  },
  {
    title: 'Prompt Safety',
    detail: 'Frontend communicates safety-block outcomes with user-friendly guidance.',
  },
  {
    title: 'Cache Transparency',
    detail: 'Surface X-Cache metadata so you can evaluate cache hit behavior quickly.',
  },
];

export function FeatureGrid() {
  return (
    <section id="capabilities" className="panel">
      <div className="section-heading">
        <p className="eyebrow">Capabilities</p>
        <h2>Designed for operational clarity</h2>
      </div>
      <div className="feature-grid">
        {FEATURES.map((item) => (
          <article key={item.title} className="feature-card">
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
