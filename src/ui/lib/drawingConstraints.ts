import { TIMEFRAMES, type TimeframeKey } from '../hooks/usePriceData';
import type { DrawnPoint } from '../components/DrawingChart';
import { DEFAULT_MAX_HOURLY_LOG_MOVE } from './marketConstants';
const SLOPE_LIMIT_MULTIPLE = 3;

export interface DrawingConstraintSummary {
  controlPoints: number;
  minSpacingSeconds: number;
  maxHourlyLogMove: number;
  maxSlopeLogMovePerHour: number;
}

interface NormalizeDrawingOptions {
  rawPath: DrawnPoint[];
  timeframe: TimeframeKey;
  startTime: number;
  endTime: number;
  startPrice: number;
  maxHourlyLogMove?: number;
}

export function getDrawingConstraintSummary(
  timeframe: TimeframeKey,
  maxHourlyLogMove: number = DEFAULT_MAX_HOURLY_LOG_MOVE,
): DrawingConstraintSummary {
  const tf = TIMEFRAMES[timeframe];

  return {
    controlPoints: tf.controlPoints,
    minSpacingSeconds: (tf.minutes * 60) / tf.controlPoints / 2,
    maxHourlyLogMove,
    maxSlopeLogMovePerHour: maxHourlyLogMove * SLOPE_LIMIT_MULTIPLE,
  };
}

export function normalizeDrawnPath({
  rawPath,
  timeframe,
  startTime,
  endTime,
  startPrice,
  maxHourlyLogMove = DEFAULT_MAX_HOURLY_LOG_MOVE,
}: NormalizeDrawingOptions): DrawnPoint[] {
  if (rawPath.length < 2 || endTime <= startTime || startPrice <= 0) {
    return [];
  }

  const { controlPoints } = getDrawingConstraintSummary(
    timeframe,
    maxHourlyLogMove,
  );
  const clampedPath = anchorAndClampPath(rawPath, startTime, endTime, startPrice);
  const targetTimes = Array.from({ length: controlPoints }, (_, index) => {
    const progress = index / (controlPoints - 1);
    return startTime + progress * (endTime - startTime);
  });

  const sampled = targetTimes.map((time) => ({
    time,
    price: interpolatePriceAtTime(clampedPath, time),
  }));

  return clampSegmentSlopes(sampled, maxHourlyLogMove);
}

function anchorAndClampPath(
  rawPath: DrawnPoint[],
  startTime: number,
  endTime: number,
  startPrice: number,
): DrawnPoint[] {
  const deduped = rawPath
    .map((point) => ({
      time: Math.max(startTime, Math.min(endTime, point.time)),
      price: Math.max(1e-9, point.price),
    }))
    .sort((left, right) => left.time - right.time)
    .filter(
      (point, index, points) =>
        index === 0 || point.time > points[index - 1]!.time,
    );

  const anchored: DrawnPoint[] = [{ time: startTime, price: startPrice }];
  for (const point of deduped) {
    if (point.time <= startTime || point.time >= endTime) {
      continue;
    }
    anchored.push(point);
  }

  const lastPrice = deduped[deduped.length - 1]?.price ?? startPrice;
  anchored.push({ time: endTime, price: lastPrice });
  return anchored;
}

function interpolatePriceAtTime(path: DrawnPoint[], time: number): number {
  if (path.length === 1) {
    return path[0]!.price;
  }

  let segmentIndex = 0;
  while (
    segmentIndex < path.length - 2 &&
    path[segmentIndex + 1]!.time < time
  ) {
    segmentIndex++;
  }

  const start = path[segmentIndex]!;
  const end = path[Math.min(segmentIndex + 1, path.length - 1)]!;
  if (end.time === start.time) {
    return end.price;
  }

  const progress = (time - start.time) / (end.time - start.time);
  return start.price + progress * (end.price - start.price);
}

function clampSegmentSlopes(
  points: DrawnPoint[],
  maxHourlyLogMove: number,
): DrawnPoint[] {
  if (points.length === 0) {
    return [];
  }

  const normalized: DrawnPoint[] = [points[0]!];

  for (let index = 1; index < points.length; index++) {
    const previous = normalized[index - 1]!;
    const candidate = points[index]!;
    const hours = (candidate.time - previous.time) / 3600;
    const maxDelta =
      Math.max(hours, 1 / 60) * maxHourlyLogMove * SLOPE_LIMIT_MULTIPLE;
    const rawDelta = Math.log(Math.max(candidate.price, 1e-9) / previous.price);
    const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, rawDelta));

    normalized.push({
      time: candidate.time,
      price: previous.price * Math.exp(clampedDelta),
    });
  }

  return normalized;
}
