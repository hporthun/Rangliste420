/**
 * Lineare Regression über chronologisch sortierte R_A-Werte einer Saison.
 * Trend-KPI = Steigung; je größer, desto stärker der Aufstieg.
 *
 * Reine Funktion, keine DB-Zugriffe.
 */

export type TrendInput = {
  /** R_A-Wert pro Regatta, chronologisch eingefügt (ältester zuerst). */
  values: number[];
};

export type TrendResult = {
  /** Steigung der Regressionsgeraden (R_A pro Regatta-Index). */
  slope: number;
  /** Y-Achsenabschnitt — relevant für die Sparkline. */
  intercept: number;
  /** Bestimmtheitsmaß R² (0..1). 1 = perfekt linearer Trend, 0 = null Erklärungsgehalt. */
  r2: number;
  /** Anzahl Datenpunkte. */
  n: number;
};

/**
 * Lineare Regression mit der x-Achse = Index 0..n−1 (gleichmäßiger Abstand).
 * Gleichmäßiger Index ist robuster als reale Datums-Abstände, weil eine
 * dichte Regatten-Phase sonst dominieren würde.
 *
 * Bei n < 2 ist keine Regression möglich → slope=0, r2=0.
 * Bei perfekt konstanten y-Werten ist r² mathematisch undefiniert (0/0);
 * wir geben r²=1 zurück (Modell erklärt die Varianz perfekt — sie ist nur null).
 */
export function linearTrend({ values }: TrendInput): TrendResult {
  const n = values.length;
  if (n < 2) {
    return { slope: 0, intercept: values[0] ?? 0, r2: 0, n };
  }

  // Mittelwerte
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i]!;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  // Varianz / Kovarianz
  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    const dy = values[i]! - meanY;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }

  if (ssXX === 0) {
    return { slope: 0, intercept: meanY, r2: 0, n };
  }
  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  // Bei konstanten y-Werten ist ssYY = 0; das Modell erklärt die (null-)Varianz perfekt.
  const r2 = ssYY === 0 ? 1 : Math.min(1, Math.max(0, (ssXY * ssXY) / (ssXX * ssYY)));

  return { slope, intercept, r2, n };
}

/**
 * Liefert die y-Werte der Regressionsgeraden für die Indizes 0..n−1.
 * Praktisch für die Sparkline-Trendlinie.
 */
export function trendLine(intercept: number, slope: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(intercept + slope * i);
  return out;
}
