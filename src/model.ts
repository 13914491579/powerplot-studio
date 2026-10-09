import type { Dataset } from './parser';
export const COLORS = ['#E53935', '#D4A000', '#2563EB', '#059669', '#9333EA', '#EA580C', '#0891B2'];
export type CurveStyle = { name: string; color: string; visible: boolean; width?: number; dash?: 'solid' | 'dash' | 'dot' | 'dashdot'; showLegend?: boolean; panel?: number };
export type Styles = Record<string, CurveStyle>;
export const curveKey = (id: string, index: number) => `${id}:${index}`;
export function tracesFor(files: Dataset[], styles: Styles, merged: boolean) {
  return files.flatMap(file => file.signals.map((s, i) => {
    const style = styles[curveKey(file.id, i)] ?? { name: s.name, color: COLORS[i % COLORS.length], visible: true };
    return { x: file.time, y: s.values, name: merged ? `${file.filename} · ${style.name}` : style.name, type: 'scatter' as const, mode: (file.time.length === 1 ? 'markers' : 'lines') as 'markers' | 'lines', line: { color: style.color, width: (style.width ?? 1.5) * 96 / 72, dash: style.dash ?? 'solid', simplify: false }, showlegend: style.showLegend ?? true, visible: style.visible ? true as const : 'legendonly' as const };
  }));
}
