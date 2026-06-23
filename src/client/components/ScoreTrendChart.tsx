type ScoreTrendChartProps = {
  title: string;
  latestValue: string;
  points: Array<{ timestamp: string; value: number }>;
  description?: string;
};

const CHART_WIDTH = 220;
const CHART_HEIGHT = 88;
const CHART_PADDING = 10;
const MIN_CHART_VALUE = 0;
const MAX_CHART_VALUE = 100;

const formatTimeLabel = (timestamp: string): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

export const ScoreTrendChart = ({
  title,
  latestValue,
  points,
  description
}: ScoreTrendChartProps) => {
  const safePoints =
    points.length > 0
      ? points
      : [{ timestamp: new Date().toISOString(), value: 0 }];
  const minValue = MIN_CHART_VALUE;
  const maxValue = MAX_CHART_VALUE;
  const range = maxValue - minValue || 1;

  const chartPoints = safePoints.map((point, index) => {
    const clampedValue = Math.max(
      minValue,
      Math.min(maxValue, point.value)
    );
    const x =
      safePoints.length === 1
        ? CHART_WIDTH / 2
        : CHART_PADDING +
          (index / (safePoints.length - 1)) *
            (CHART_WIDTH - CHART_PADDING * 2);
    const y =
      CHART_HEIGHT -
      CHART_PADDING -
      ((clampedValue - minValue) / range) *
        (CHART_HEIGHT - CHART_PADDING * 2);

    return { x, y };
  });

  const polylinePoints = chartPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return (
    <article className="trend-card">
      <div className="trend-card__header">
        {description ? (
          <span
            className="detail-tooltip-label"
            data-tooltip={description}
            aria-label={`${title}. ${description}`}
            tabIndex={0}
          >
            {title}
          </span>
        ) : (
          <span>{title}</span>
        )}
        <strong>{latestValue}</strong>
      </div>
      <svg
        className="trend-card__chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`${title} trend`}
      >
        <line
          x1={CHART_PADDING}
          y1={CHART_HEIGHT - CHART_PADDING}
          x2={CHART_WIDTH - CHART_PADDING}
          y2={CHART_HEIGHT - CHART_PADDING}
          className="trend-card__axis"
        />
        <polyline
          fill="none"
          points={polylinePoints}
          className="trend-card__line"
        />
        {chartPoints.map((point, index) => (
          <circle
            key={`${safePoints[index].timestamp}-${safePoints[index].value}`}
            cx={point.x}
            cy={point.y}
            r={4}
            className="trend-card__point"
          />
        ))}
      </svg>
      <div className="trend-card__footer">
        <span>{formatTimeLabel(safePoints[0].timestamp)}</span>
        <span>{formatTimeLabel(safePoints[safePoints.length - 1].timestamp)}</span>
      </div>
    </article>
  );
};
