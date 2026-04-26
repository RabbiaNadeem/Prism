import { useDeferredScrollSpy } from '../../lib/perf';

const LINKS = [
  { href: '#overview', label: 'Overview' },
  { href: '#playground', label: 'Playground' },
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#performance', label: 'Performance' },
];

export function NavBar() {
  useDeferredScrollSpy();

  return (
    <header className="top-nav-wrap">
      <div className="top-nav">
        <a className="brand" href="#overview">
          <span className="brand-dot" />
          Prism
        </a>
        <nav aria-label="Primary">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
