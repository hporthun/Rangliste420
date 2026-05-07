/**
 * Reine Server-SVG-Komponente für vertikale Bar-Charts.
 * Kein Client-Bundle, keine Dependency. Bewusst minimal: ein Datensatz,
 * Achsenbeschriftung unten + links, Y-Wert über der Säule.
 */

export type BarDatum = {
  /** Achsen-Label unter der Säule. */
  label: string;
  /** Numerischer Wert (≥ 0). */
  value: number;
  /** Optionaler Tooltip auf <title>. */
  title?: string;
};

type Props = {
  data: BarDatum[];
  /** Maximale Höhe der Bars in px. */
  height?: number;
  /** Mindestbreite einer Säule in px. */
  minBarWidth?: number;
  /** Tailwind-Farbklasse für die Bar (fill). Default: chart-1. */
  barClass?: string;
  /** Aria-Label für die Grafik insgesamt. */
  ariaLabel: string;
  /** Format-Funktion für die Wert-Beschriftung (Default: toLocaleString de). */
  formatValue?: (n: number) => string;
};

export function BarChart({
  data,
  height = 180,
  minBarWidth = 32,
  barClass = "fill-[var(--chart-1)]",
  ariaLabel,
  formatValue = (n) => n.toLocaleString("de-DE"),
}: Props) {
  const barGap = 8;
  const paddingX = 12;
  const labelHeight = 22; // unten für x-Label
  const valueHeight = 14; // oben für Wert
  const innerHeight = height;
  const totalHeight = innerHeight + labelHeight + valueHeight;

  const barWidth = Math.max(minBarWidth, 36);
  const totalWidth = paddingX * 2 + data.length * barWidth + (data.length - 1) * barGap;

  const max = Math.max(0, ...data.map((d) => d.value));
  const scale = (v: number) => (max === 0 ? 0 : (v / max) * innerHeight);

  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic px-3 py-6">
        Keine Daten verfügbar.
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width="100%"
      height={totalHeight}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
      className="overflow-visible"
    >
      {/* Baseline */}
      <line
        x1={paddingX}
        x2={totalWidth - paddingX}
        y1={valueHeight + innerHeight}
        y2={valueHeight + innerHeight}
        className="stroke-border"
        strokeWidth={1}
      />

      {data.map((d, i) => {
        const h = scale(d.value);
        const x = paddingX + i * (barWidth + barGap);
        const y = valueHeight + (innerHeight - h);
        return (
          <g key={`${d.label}-${i}`}>
            {d.title && <title>{d.title}</title>}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              className={barClass}
              rx={3}
            />
            {/* Wert über der Säule */}
            <text
              x={x + barWidth / 2}
              y={y - 4}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-medium tabular-nums"
            >
              {formatValue(d.value)}
            </text>
            {/* Label unter der Achse */}
            <text
              x={x + barWidth / 2}
              y={valueHeight + innerHeight + 14}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
