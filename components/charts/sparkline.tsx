/**
 * Reine Server-SVG-Sparkline mit optionaler Trendlinie.
 * Datenpunkte als kleine Kreise, Verbindungspolyline, gestrichelte Trendlinie.
 */

type Props = {
  values: number[];
  /** Optionaler Trend (z.B. aus linearTrend); wird als gestrichelte Linie gerendert. */
  trendLine?: number[];
  width?: number;
  height?: number;
  ariaLabel: string;
};

export function Sparkline({
  values,
  trendLine,
  width = 120,
  height = 32,
  ariaLabel,
}: Props) {
  if (values.length === 0) {
    return <span className="text-xs text-muted-foreground italic">—</span>;
  }

  const padX = 4;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  // Y-Range: Min/Max über values + trendLine, damit beide auf derselben Skala liegen.
  const allYs = trendLine ? [...values, ...trendLine] : values;
  const minY = Math.min(...allYs);
  const maxY = Math.max(...allYs);
  const rangeY = maxY - minY || 1;

  const xAt = (i: number) =>
    values.length === 1 ? padX + innerW / 2 : padX + (i / (values.length - 1)) * innerW;
  const yAt = (v: number) => padY + innerH - ((v - minY) / rangeY) * innerH;

  const polyPoints = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  const trendPoints = trendLine
    ? trendLine.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ")
    : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
      className="overflow-visible"
    >
      {/* Trendlinie zuerst, damit sie unter den Datenpunkten liegt */}
      {trendPoints && (
        <polyline
          points={trendPoints}
          fill="none"
          className="stroke-[var(--chart-5)]"
          strokeWidth={1}
          strokeDasharray="2 2"
          opacity={0.7}
        />
      )}
      {/* Polyline durch die Werte */}
      <polyline
        points={polyPoints}
        fill="none"
        className="stroke-[var(--chart-1)]"
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
      {/* Punkte */}
      {values.map((v, i) => (
        <circle
          key={i}
          cx={xAt(i)}
          cy={yAt(v)}
          r={1.6}
          className="fill-[var(--chart-1)]"
        />
      ))}
    </svg>
  );
}
