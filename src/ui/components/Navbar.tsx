import { Link } from 'react-router-dom';

export function Navbar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-4"
      style={{
        background: 'rgba(9, 9, 11, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="M4 23 L11 15 L16 19 L23 8 L28 13"
            stroke="var(--accent)"
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="dtc-display text-[17px]"
          style={{ color: 'var(--text-primary)' }}
        >
          Draw The Chart
        </span>
      </Link>
    </nav>
  );
}
