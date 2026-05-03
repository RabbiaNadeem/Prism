import { useDeferredScrollSpy } from '../../lib/perf';

const LINKS = [
  { href: '#playground', label: 'Playground' },
  { href: '#capabilities', label: 'Capabilities' },
];

export function NavBar() {
  useDeferredScrollSpy();

  return (
    <header className="top-nav-wrap">
      <div className="top-nav">
        <a className="brand" href="#playground">
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
