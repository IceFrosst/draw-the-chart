import type { ReactNode } from 'react';
import type { TAToolType } from './TAOverlay';

interface TAToolbarProps {
  activeTool: TAToolType;
  onSelectTool: (tool: TAToolType) => void;
  onClearAll: () => void;
  hasDrawings: boolean;
}

const tools: Array<{
  type: TAToolType;
  label: string;
  title: string;
  icon: ReactNode;
}> = [
  {
    type: 'none',
    label: 'Cursor',
    title: 'Cursor',
    icon: (
      <svg viewBox="0 0 18 18" width="16" height="16" fill="none">
        <path d="M4 2.5 13.8 9l-4.2 1.1 2 5.4-2 .7-2-5.4L4 13.8V2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: 'trendline',
    label: 'Trend',
    title: 'Trend Line',
    icon: (
      <svg viewBox="0 0 18 18" width="16" height="16" fill="none">
        <circle cx="4.5" cy="13.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="13.5" cy="4.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 12 12 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: 'ray',
    label: 'Ray',
    title: 'Ray',
    icon: (
      <svg viewBox="0 0 18 18" width="16" height="16" fill="none">
        <circle cx="4" cy="13.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 12.2 15 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="m11.7 3.2 3.3-.1-.1 3.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: 'hline',
    label: 'H-Line',
    title: 'Horizontal Line',
    icon: (
      <svg viewBox="0 0 18 18" width="16" height="16" fill="none">
        <path d="M2.5 9h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="6" cy="9" r="1.7" fill="currentColor" />
      </svg>
    ),
  },
  {
    type: 'fib',
    label: 'Fib',
    title: 'Fibonacci Retracement',
    icon: (
      <svg viewBox="0 0 18 18" width="16" height="16" fill="none">
        <path d="M4 4h10M4 8h7M4 12h9M4 15h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function TAToolbar({
  activeTool,
  onSelectTool,
  onClearAll,
  hasDrawings,
}: TAToolbarProps) {
  return (
    <div
      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5 px-1.5 py-2"
      style={{
        width: '64px',
        background: 'rgba(17, 17, 19, 0.95)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        borderRadius: '8px',
      }}
    >
      {tools.map((tool) => {
        const active = activeTool === tool.type;
        return (
          <button
            key={tool.type}
            type="button"
            title={tool.title}
            onClick={() => onSelectTool(tool.type)}
            className="flex flex-col items-center justify-center gap-0.5 rounded px-1 py-1.5 text-[9px] transition-all"
            style={{
              background: active ? 'var(--accent)' : 'transparent',
              border: active ? 'none' : '1px solid transparent',
              color: active ? '#000' : 'var(--text-muted)',
            }}
          >
            <span className="flex h-4 items-center justify-center">{tool.icon}</span>
            <span className="leading-none">{tool.label}</span>
          </button>
        );
      })}
      <div className="mx-1 h-px" style={{ background: 'var(--border)' }} />
      <button
        type="button"
        onClick={onClearAll}
        disabled={!hasDrawings}
        className="rounded px-1 py-1.5 text-[9px] transition-all"
        style={{
          background: hasDrawings ? 'var(--red-soft)' : 'transparent',
          border: hasDrawings ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent',
          color: hasDrawings ? 'var(--red)' : 'var(--text-muted)',
          opacity: hasDrawings ? 1 : 0.4,
          cursor: hasDrawings ? 'pointer' : 'default',
        }}
      >
        Clear
      </button>
    </div>
  );
}
