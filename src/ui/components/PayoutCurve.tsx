import { useMemo } from 'react';
import { generatePayoutCurve, DEFAULT_PAYOUT_CONFIG, type PayoutConfig } from '../../scoring/payout';

interface PayoutCurveProps {
  currentScore?: number;
  config?: PayoutConfig;
}

const WIDTH = 280;
const HEIGHT = 160;
const PAD = { top: 12, right: 16, bottom: 28, left: 40 };

export function PayoutCurve({ currentScore, config = DEFAULT_PAYOUT_CONFIG }: PayoutCurveProps) {
  const curve = useMemo(() => generatePayoutCurve(config), [config]);
  const yMin = config.minMultiplier;
  const yMax = config.maxMultiplier;
  const logMin = Math.log(yMin);
  const logMax = Math.log(yMax);

  const xScale = (score: number) =>
    PAD.left + ((score / 100) * (WIDTH - PAD.left - PAD.right));
  const yScale = (mult: number) =>
    HEIGHT -
    PAD.bottom -
    ((Math.log(Math.max(mult, yMin)) - logMin) / (logMax - logMin)) *
      (HEIGHT - PAD.top - PAD.bottom);

  // Build SVG path
  const pathD = curve
    .map((p, i) => {
      const x = xScale(p.score);
      const y = yScale(p.multiplier);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  // Break-even line
  const beX = xScale(config.breakEvenScore * 100);
  const beY = yScale(1);
  const yTicks = [0.3, 0.5, 1, 2, 5, 10, 20, 50].filter(
    (value) => value >= yMin && value <= yMax,
  );

  // Current score marker
  let markerX: number | undefined;
  let markerY: number | undefined;
  let markerMult: number | undefined;
  if (currentScore !== undefined) {
    const entry = curve.reduce((best, p) =>
      Math.abs(p.score - currentScore) < Math.abs(best.score - currentScore) ? p : best
    );
    markerMult = entry.multiplier;
    markerX = xScale(currentScore);
    markerY = yScale(entry.multiplier);
  }

  return (
    <div
      className="dtc-panel p-4"
      style={{
        minWidth: '320px',
        background: 'rgba(17, 17, 19, 0.96)',
      }}
    >
      <div className="dtc-eyebrow mb-1">Multiplier Surface</div>
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <div className="dtc-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Payout Curve
          </div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Log scale from {config.minMultiplier.toFixed(1)}x to {config.maxMultiplier.toFixed(0)}x
          </div>
        </div>
        <div className="dtc-chip">
          <span>Break-even</span>
          <span className="dtc-data" style={{ color: 'var(--accent)' }}>
            {(config.breakEvenScore * 100).toFixed(0)}
          </span>
        </div>
      </div>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <defs>
          <linearGradient id="refund-zone-fill" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(239, 68, 68, 0.06)" />
            <stop offset="100%" stopColor="rgba(239, 68, 68, 0.02)" />
          </linearGradient>
          <linearGradient id="profit-zone-fill" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(34, 197, 94, 0.04)" />
            <stop offset="100%" stopColor="rgba(34, 197, 94, 0.08)" />
          </linearGradient>
        </defs>

        <rect
          x={PAD.left}
          y={PAD.top}
          width={Math.max(0, beX - PAD.left)}
          height={HEIGHT - PAD.top - PAD.bottom}
          fill="url(#refund-zone-fill)"
        />
        <rect
          x={beX}
          y={PAD.top}
          width={Math.max(0, WIDTH - PAD.right - beX)}
          height={HEIGHT - PAD.top - PAD.bottom}
          fill="url(#profit-zone-fill)"
        />

        {/* Grid lines */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left} y1={yScale(v)}
              x2={WIDTH - PAD.right} y2={yScale(v)}
              stroke="rgba(255, 255, 255, 0.06)" strokeWidth={1}
            />
            <text x={PAD.left - 4} y={yScale(v) + 4} textAnchor="end"
              fill="var(--text-muted)" fontSize={9} className="dtc-data">{v}x</text>
          </g>
        ))}

        {/* X-axis labels */}
        {[0, 25, 50, 75, 100].map((s) => (
          <text key={s} x={xScale(s)} y={HEIGHT - 6} textAnchor="middle"
            fill="var(--text-muted)" fontSize={9} className="dtc-data">{s}</text>
        ))}

        {/* Break-even vertical line */}
        <line x1={beX} y1={PAD.top} x2={beX} y2={HEIGHT - PAD.bottom}
          stroke="rgba(255, 255, 255, 0.15)" strokeWidth={1} strokeDasharray="3,3" opacity={0.7} />
        <line x1={PAD.left} y1={beY} x2={WIDTH - PAD.right} y2={beY}
          stroke="rgba(255, 255, 255, 0.12)" strokeWidth={1} strokeDasharray="3,3" opacity={0.65} />

        <text
          x={(PAD.left + beX) / 2}
          y={PAD.top + 11}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={9}
          className="dtc-data"
        >
          REFUND
        </text>
        <text
          x={(beX + WIDTH - PAD.right) / 2}
          y={PAD.top + 11}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={9}
          className="dtc-data"
        >
          PROFIT
        </text>

        {/* Curve */}
        <path d={pathD} fill="none" stroke="#d4a85c" strokeWidth={2} />

        {/* Current score marker */}
        {markerX !== undefined && markerY !== undefined && markerMult !== undefined && (
          <>
            <line x1={markerX} y1={PAD.top} x2={markerX} y2={HEIGHT - PAD.bottom}
              stroke={markerMult >= 1 ? '#67c1b4' : '#ef4444'} strokeWidth={1} strokeDasharray="2,2" opacity={0.75} />
            <circle cx={markerX} cy={markerY} r={4}
              fill={markerMult >= 1 ? '#67c1b4' : '#ef4444'} />
            <text x={markerX + 6} y={markerY - 6} fill={markerMult >= 1 ? '#67c1b4' : '#ef4444'}
              fontSize={10} fontWeight="bold" className="dtc-data">{markerMult.toFixed(2)}x</text>
          </>
        )}
      </svg>
      {currentScore !== undefined && markerMult !== undefined && (
        <div className="mt-2 flex items-center justify-between gap-3 text-xs dtc-data">
          <span style={{ color: 'var(--text-secondary)' }}>
            Score {currentScore.toFixed(1)}
          </span>
          <span style={{ color: markerMult >= 1 ? 'var(--green)' : 'var(--red)' }}>
            {markerMult >= 1 ? `+${((markerMult - 1) * 100).toFixed(0)}% profit` : `${((1 - markerMult) * 100).toFixed(0)}% loss`}
          </span>
        </div>
      )}
    </div>
  );
}
