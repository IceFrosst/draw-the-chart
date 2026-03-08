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
      className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 px-2 py-3"
      style={{
        width: '78px',
        background:
          'linear-gradient(180deg, rgba(10, 13, 11, 0.96), rgba(14, 18, 15, 0.92))',
        border: '1px solid rgba(58, 70, 59, 0.82)',
        boxShadow: 'var(--shadow-soft)',
        backdropFilter: 'blur(16px)',
        borderRadius: '14px',
      }}
    >
      <div className="px-1">
        <div className="dtc-eyebrow" style={{ color: 'var(--text-muted)' }}>
          Tools
        </div>
        <div className="mt-1 text-[11px] dtc-data" style={{ color: 'var(--text-secondary)' }}>
          {activeTool === 'none' ? 'Cursor' : tools.find((tool) => tool.type === activeTool)?.title ?? 'Tool'}
        </div>
      </div>
      {tools.map((tool) => {
        const active = activeTool === tool.type;
        return (
          <button
            key={tool.type}
            type="button"
            title={tool.title}
            onClick={() => onSelectTool(tool.type)}
            className="group flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] transition-all"
            style={{
              background: active
                ? 'linear-gradient(180deg, #dfb27d, #cf7b35)'
                : 'rgba(16, 21, 18, 0.82)',
              border: active
                ? '1px solid rgba(255, 214, 176, 0.58)'
                : '1px solid rgba(58, 70, 59, 0.68)',
              color: active ? '#120d09' : 'var(--text-secondary)',
              boxShadow: active ? '0 10px 24px rgba(163, 93, 29, 0.24)' : 'none',
            }}
          >
            <span className="flex h-4 items-center justify-center">{tool.icon}</span>
            <span className="leading-none">{tool.label}</span>
          </button>
        );
      })}
      <div className="mx-1 h-px" style={{ background: 'rgba(58, 70, 59, 0.72)' }} />
      <button
        type="button"
        onClick={onClearAll}
        disabled={!hasDrawings}
        className="rounded-xl px-1 py-2 text-[10px] transition-all"
        style={{
          background: hasDrawings ? 'rgba(63, 16, 22, 0.9)' : 'rgba(15, 21, 34, 0.55)',
          border: hasDrawings
            ? '1px solid rgba(216, 104, 88, 0.6)'
            : '1px solid rgba(58, 70, 59, 0.55)',
          color: hasDrawings ? '#efb0a6' : 'var(--text-muted)',
          opacity: hasDrawings ? 1 : 0.6,
          cursor: hasDrawings ? 'pointer' : 'default',
        }}
      >
        Clear All
      </button>
      <div className="px-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>
        Switch back to Cursor to keep drawing.
      </div>
    </div>
  );
}
