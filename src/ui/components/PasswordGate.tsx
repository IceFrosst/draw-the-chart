import { useState, type ReactNode } from 'react';

const REQUIRED_PASSWORD = import.meta.env.VITE_APP_PASSWORD as string | undefined;
const SESSION_KEY = 'dtc.auth';

function hashSimple(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function isAuthenticated(): boolean {
  if (!REQUIRED_PASSWORD) return true;
  return sessionStorage.getItem(SESSION_KEY) === hashSimple(REQUIRED_PASSWORD);
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(isAuthenticated);
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  if (authed) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === REQUIRED_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, hashSimple(value));
      setAuthed(true);
    } else {
      setError(true);
      setValue('');
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)', zIndex: 100 }}
    >
      <form
        onSubmit={handleSubmit}
        className="dtc-panel p-8 w-full max-w-sm text-center space-y-6"
      >
        <div>
          <h1 className="dtc-display text-xl" style={{ color: 'var(--text-primary)' }}>
            Draw The Chart
          </h1>
          <p className="dtc-eyebrow mt-2">Private Testing</p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            placeholder="Enter password"
            autoFocus
            className="w-full h-10 px-3 text-sm rounded"
            style={{
              background: 'var(--bg-tertiary)',
              border: `1px solid ${error ? 'var(--red)' : 'var(--border-strong)'}`,
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          {error && (
            <p className="text-xs" style={{ color: 'var(--red)' }}>
              Wrong password
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!value}
          className="dtc-button-primary w-full h-10 text-sm font-semibold"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
