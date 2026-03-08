import { describe, expect, it } from 'vitest';
import {
  getDrawingConstraintSummary,
  normalizeDrawnPath,
} from './drawingConstraints';
import { DEFAULT_MAX_HOURLY_LOG_MOVE } from './marketConstants';

describe('normalizeDrawnPath', () => {
  it('converts a raw path into fixed control points spanning the full horizon', () => {
    const normalized = normalizeDrawnPath({
      rawPath: [
        { time: 0, price: 100 },
        { time: 300, price: 104 },
        { time: 900, price: 108 },
      ],
      timeframe: '15m',
      startTime: 0,
      endTime: 900,
      startPrice: 100,
    });

    const rules = getDrawingConstraintSummary('15m');
    expect(normalized).toHaveLength(rules.controlPoints);
    expect(normalized[0]).toEqual({ time: 0, price: 100 });
    expect(normalized[normalized.length - 1]!.time).toBe(900);

    for (let index = 1; index < normalized.length; index++) {
      expect(normalized[index]!.time - normalized[index - 1]!.time).toBeGreaterThanOrEqual(
        rules.minSpacingSeconds,
      );
    }
  });

  it('clamps extreme slopes to the configured hourly move limit', () => {
    const normalized = normalizeDrawnPath({
      rawPath: [
        { time: 0, price: 100 },
        { time: 60, price: 300 },
      ],
      timeframe: '15m',
      startTime: 0,
      endTime: 60,
      startPrice: 100,
      maxHourlyLogMove: DEFAULT_MAX_HOURLY_LOG_MOVE,
    });

    const allowedDelta =
      DEFAULT_MAX_HOURLY_LOG_MOVE * 3 * Math.max((60 / 7) / 3600, 1 / 60);
    const firstSegmentDelta = Math.log(
      normalized[1]!.price / normalized[0]!.price,
    );

    expect(firstSegmentDelta).toBeLessThanOrEqual(allowedDelta + 1e-9);
  });
});
