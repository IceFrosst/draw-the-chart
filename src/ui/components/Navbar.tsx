import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/play', label: 'Trade' },
  { to: '/leaderboard', label: 'Journal' },
  { to: '/faq', label: 'Docs' },
  { to: '/whitepaper', label: 'Paper' },
];

export function Navbar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-4"
        style={{
          background: 'rgba(9, 9, 11, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span
              className="text-[15px] font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              DTC
            </span>
            <span
              className="text-[10px] font-medium tracking-[0.08em] uppercase hidden sm:inline"
              style={{ color: 'var(--text-muted)' }}
            >
              Draw The Chart
            </span>
          </Link>

          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className="px-3 py-1.5 text-[13px] no-underline rounded"
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: active ? 600 : 400,
                    background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-medium tracking-[0.06em] uppercase px-2 py-1 rounded hidden sm:inline-flex items-center gap-1.5"
            title="Using historical data — no real money"
            style={{
              color: 'var(--green)',
              background: 'var(--green-soft)',
              border: '1px solid rgba(34, 197, 94, 0.15)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
            Sandbox
          </span>

          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="sm:hidden flex flex-col gap-[3px] p-2"
            aria-label="Menu"
          >
            <span className="block w-4 h-[1.5px]" style={{ background: 'var(--text-secondary)' }} />
            <span className="block w-4 h-[1.5px]" style={{ background: 'var(--text-secondary)' }} />
            <span className="block w-4 h-[1.5px]" style={{ background: 'var(--text-secondary)' }} />
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] pt-12"
          style={{ background: '#09090b' }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="flex flex-col p-3 gap-0.5">
            {NAV_LINKS.map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 text-sm no-underline rounded"
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
