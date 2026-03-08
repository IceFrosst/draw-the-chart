import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/play', label: 'Play' },
  { to: '/whitepaper', label: 'Whitepaper' },
  { to: '/faq', label: 'How It Works' },
  { to: '/leaderboard', label: 'Journal' },
];

export function Navbar() {
  const location = useLocation();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 sm:px-6"
        style={{
          background: 'rgba(9, 12, 10, 0.9)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(55, 64, 55, 0.72)',
        }}
      >
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className="flex flex-col leading-none">
              <span
                className="dtc-display text-[22px] font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                DTC
              </span>
              <span className="dtc-eyebrow" style={{ letterSpacing: '0.22em' }}>
                Draw The Chart
              </span>
            </div>
          </Link>

          <div className="hidden sm:flex items-center gap-5">
            {NAV_LINKS.map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className="relative py-4 text-sm no-underline transition-colors"
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {link.label}
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 2,
                      background: active ? 'var(--accent)' : 'transparent',
                    }}
                  />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowStatusModal(true)}
            className="hidden sm:block px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: 'rgba(17, 22, 18, 0.9)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
            }}
          >
            Launch Status
          </button>

          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="sm:hidden flex flex-col gap-1 p-2"
            aria-label="Menu"
          >
            <span className="block w-5 h-[1.5px]" style={{ background: 'var(--text-secondary)' }} />
            <span className="block w-5 h-[1.5px]" style={{ background: 'var(--text-secondary)' }} />
            <span className="block w-5 h-[1.5px]" style={{ background: 'var(--text-secondary)' }} />
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] pt-14"
          style={{ background: 'rgba(9, 12, 10, 0.98)', backdropFilter: 'blur(12px)' }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="flex flex-col p-4 gap-1">
            {NAV_LINKS.map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 text-base no-underline"
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                    background: active ? 'rgba(26, 31, 27, 0.72)' : 'transparent',
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowStatusModal(true);
              }}
              className="mt-3 px-4 py-3 text-base text-left"
              style={{
                color: 'var(--text-primary)',
                background: 'rgba(17, 22, 18, 0.9)',
                border: '1px solid var(--border-strong)',
              }}
            >
              Launch Status
            </button>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0, 0, 0, 0.66)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowStatusModal(false)}
        >
          <div
            className="max-w-sm mx-4 p-8 text-center dtc-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dtc-eyebrow mb-3">Status</div>
            <h3 className="dtc-display text-3xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Sandbox-First
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              This build is focused on drawing feel, scoring, replayability, and fairness tooling. Wallets, live bankroll-backed rounds, and settlement plumbing are intentionally not active yet.
            </p>
            <button
              onClick={() => setShowStatusModal(false)}
              className="px-6 py-2 text-sm font-semibold dtc-button-primary"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
