import type { Dataset } from './parser';
import { curveKey, type Styles, type CurveStyle } from './model';

export type Dash = 'solid' | 'dash' | 'dot' | 'dashdot';
export interface AxisConfig {
  title: string; unit?: string; autoRange: boolean; min: number; max: number;
  ticks: 'auto' | 'interval' | 'count'; interval: number; count: number; decimals: number | null;
  grid: boolean; gridColor: string; gridWidth: number; gridDash: Dash;
  lineColor: string; lineWidth: number;
}
export interface PlotConfig {
  mode: 'paper' | 'free'; template: 'single' | 'double' | 'custom';
  size: { unit: 'inch' | 'mm'; width: number; height: number; dpi: number };
  x: AxisConfig; y: AxisConfig[];
  font: { family: string; color: string; axis: number; tick: number; legend: number; title: number };
  title: string; margin: { l: number; r: number; t: number; b: number };
  legend: { show: boolean; position: 'top' | 'bottom' | 'left' | 'right' | 'inside' | 'manual'; orientation: 'h' | 'v'; border: boolean; opacity: number; x: number; y: number; fontSize?: number };
  panels: 1 | 2 | 3 | 4; columns: 1 | 2 | 3 | 4; sharedX: boolean; lineWidth: number;
  xPanels: AxisConfig[]; xSync: 'all' | 'column' | 'independent'; hideRepeatedX: boolean;
  sizePolicy: 'recommended' | 'manual';
  spacing: { horizontal: number; vertical: number; axisTitle: number; tick: number };
  panelOptions: { label: string; showLabel: boolean; x: number; y: number; fontSize: number; legend: PlotConfig['legend'] }[];
  legendMode: 'global' | 'panel';
}
const axis = (): AxisConfig => ({ title: '', autoRange: true, min: 0, max: 1, ticks: 'auto', interval: .1, count: 5, decimals: null, grid: true, gridColor: '#e8edf3', gridWidth: .5, gridDash: 'solid', lineColor: '#64748b', lineWidth: .65 });
export function defaultConfig(): PlotConfig {
  const legend: PlotConfig['legend'] = { show: true, position: 'top', orientation: 'h', border: false, opacity: 0, x: 0, y: 1 };
  return { mode: 'paper', template: 'single', size: { unit: 'inch', width: 3.5, height: 2.2, dpi: 600 }, x: axis(), y: Array.from({ length: 4 }, axis), font: { family: 'Times New Roman', color: '#233047', axis: 9, tick: 8, legend: 8, title: 10 }, title: '', margin: { l: 42, r: 10, t: 16, b: 32 }, legend, panels: 1, columns: 1, sharedX: true, lineWidth: 1.5,
    xPanels: Array.from({ length: 3 }, axis), xSync: 'all', hideRepeatedX: true, sizePolicy: 'recommended',
    spacing: { horizontal: 16, vertical: 14, axisTitle: 6, tick: 3 }, legendMode: 'global',
    panelOptions: Array.from({ length: 4 }, (_, i) => ({ label: `(${String.fromCharCode(97 + i)})`, showLabel: true, x: .01, y: .99, fontSize: 9, legend: { ...legend } })) };
}
export const GRID_LAYOUTS = [[1,1], [1,2], [2,1], [1,3], [3,1], [2,2], [1,4], [4,1]] as const;
export function gridShape(c: PlotConfig) { return { rows: c.panels / c.columns, columns: c.columns }; }
export function xFor(c: PlotConfig, i: number) { return i === 0 ? c.x : c.xPanels[i - 1]; }
export function updateX(c: PlotConfig, i: number, patch: Partial<AxisConfig>): PlotConfig {
  return i === 0 ? { ...c, x: { ...c.x, ...patch } } : { ...c, xPanels: c.xPanels.map((a, j) => j === i - 1 ? { ...a, ...patch } : a) };
}
export function recommendedSize(c: PlotConfig) {
  const { rows, columns } = gridShape(c);
  // Reserve a readable plotting region per row plus titles, ticks and legends.
  const height = rows === 1 ? (columns === 1 ? 2.2 : 2.7) : +(rows * 1.35 + .6 + (rows - 1) * (c.spacing.vertical + c.font.axis + c.font.tick) / 72).toFixed(2);
  return { width: columns === 1 ? 3.5 : 7.16, height };
}
export function restoreRecommendedSize(c: PlotConfig): PlotConfig {
  const s = recommendedSize(c), factor = c.size.unit === 'mm' ? 25.4 : 1;
  return { ...c, template: s.width === 3.5 ? 'single' : 'double', sizePolicy: 'recommended', size: { ...c.size, width: s.width * factor, height: s.height * factor } };
}
export function changeLayout(c: PlotConfig, rows: number, columns: number): PlotConfig {
  if (!GRID_LAYOUTS.some(([r, col]) => r === rows && col === columns)) throw new Error('不支持的子图布局');
  const next: PlotConfig = { ...c, panels: rows * columns as PlotConfig['panels'], columns: columns as PlotConfig['columns'], sharedX: columns === 1, xSync: columns === 1 ? 'all' : 'independent', hideRepeatedX: columns === 1 };
  return c.sizePolicy === 'recommended' ? restoreRecommendedSize(next) : next;
}
export function inches(size: PlotConfig['size']) { return { width: size.width / (size.unit === 'mm' ? 25.4 : 1), height: size.height / (size.unit === 'mm' ? 25.4 : 1) }; }
export function pixelSize(size: PlotConfig['size']) { const s = inches(size); return { width: Math.round(s.width * size.dpi), height: Math.round(s.height * size.dpi) }; }
export function applyTemplate(config: PlotConfig, template: PlotConfig['template']): PlotConfig {
  if (template === 'custom') return { ...config, template, sizePolicy: 'manual' };
  const base = defaultConfig();
  return { ...config, mode: 'paper', template, sizePolicy: 'manual', font: base.font, margin: base.margin, legend: base.legend, lineWidth: 1.5,
    size: { ...config.size, unit: 'inch', width: template === 'single' ? 3.5 : 7.16, height: config.panels === 1 ? (template === 'single' ? 2.2 : 3.6) : recommendedSize(config).height },
    x: { ...config.x, lineWidth: .65, lineColor: '#64748b' }, y: config.y.map(a => ({ ...a, lineWidth: .65, lineColor: '#64748b' })) };
}
export function validateConfig(c: PlotConfig): string[] {
  const errors: string[] = []; const physical = inches(c.size); const pixels = pixelSize(c.size);
  if (![physical.width, physical.height, c.size.dpi].every(Number.isFinite) || physical.width < 1 || physical.height < 1 || physical.width > 30 || physical.height > 30) errors.push('图片物理宽高需在 1–30 inch（25.4–762 mm）之间。');
  if (c.size.dpi < 72 || c.size.dpi > 1200 || pixels.width * pixels.height > 40_000_000 || Math.max(pixels.width, pixels.height) > 16000) errors.push('DPI 需在 72–1200 之间，PNG 不超过 4000 万像素且单边不超过 16000 px。');
  if (Object.values(c.margin).some(v => !Number.isFinite(v) || v < 0 || v > 150)) errors.push('边距需在 0–150 pt 之间。');
  if ([c.font.axis, c.font.tick, c.font.legend, c.font.title].some(v => !Number.isFinite(v) || v < 5 || v > 36)) errors.push('字号需在 5–36 pt 之间。');
  if (!Number.isFinite(c.lineWidth) || c.lineWidth < .1 || c.lineWidth > 10) errors.push('默认线宽需在 0.1–10 pt 之间。');
  if (!Number.isFinite(c.legend.opacity) || c.legend.opacity < 0 || c.legend.opacity > 1 || ![c.legend.x, c.legend.y].every(Number.isFinite)) errors.push('图例位置必须为有限数字，不透明度需在 0–1 之间。');
  if (Object.values(c.spacing).some(v => !Number.isFinite(v) || v < 0 || v > 150)) errors.push('子图间距和轴间距需在 0–150 pt 之间。');
  c.panelOptions.slice(0, c.panels).forEach((p, i) => {
    if (![p.x, p.y, p.fontSize, p.legend.opacity, p.legend.x, p.legend.y, p.legend.fontSize ?? c.font.legend].every(Number.isFinite) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 || p.fontSize < 5 || p.fontSize > 36 || (p.legend.fontSize ?? c.font.legend) < 5 || (p.legend.fontSize ?? c.font.legend) > 36 || p.legend.opacity < 0 || p.legend.opacity > 1) errors.push(`子图 ${i + 1} 编号位置需在 0–1，字号需在 5–36 pt，图例参数需有效。`);
  });
  [c.x, ...c.xPanels.slice(0, c.panels - 1), ...c.y.slice(0, c.panels)].forEach((a, index) => {
    const name = index === 0 ? 'X 轴' : `Y${index} 轴`;
    if (!a.autoRange && (!Number.isFinite(a.min) || !Number.isFinite(a.max) || a.min >= a.max)) errors.push(`${name}最小值必须小于最大值。`);
    if (a.ticks === 'interval' && (!Number.isFinite(a.interval) || a.interval <= 0)) errors.push(`${name}主刻度间隔必须大于零。`);
    if (a.ticks === 'count' && (!Number.isInteger(a.count) || a.count < 2 || a.count > 100)) errors.push(`${name}刻度数量需为 2–100 的整数。`);
    if ([a.gridWidth, a.lineWidth].some(v => !Number.isFinite(v) || v < .1 || v > 5)) errors.push(`${name}网格与轴线宽需在 0.1–5 pt 之间。`);
  });
  return errors;
}
export function dataExtent(values: Iterable<number>, pad = false): [number, number] {
  let min = Infinity, max = -Infinity;
  for (const v of values) { min = Math.min(min, v); max = Math.max(max, v); }
  if (!Number.isFinite(min)) return [0, 1];
  if (min === max) { const d = Math.max(Math.abs(min) * .05, .001); return [min - d, max + d]; }
  const d = pad ? (max - min) * .05 : 0;
  return [min - d, max + d];
}
export interface SyncOptions { colors: boolean; ranges: boolean }
export function syncConfig(source: PlotConfig, target: PlotConfig, options: SyncOptions): PlotConfig {
  const keepRange = (a: AxisConfig, b: AxisConfig) => options.ranges ? structuredClone(a) : { ...a, autoRange: b.autoRange, min: b.min, max: b.max };
  return { ...structuredClone(source), sizePolicy: 'manual', title: target.title, x: { ...keepRange(source.x, target.x), title: target.x.title, unit: target.x.unit }, xPanels: source.xPanels.map((a, i) => ({ ...keepRange(a, target.xPanels[i]), title: target.xPanels[i].title, unit: target.xPanels[i].unit })), y: source.y.map((a, i) => ({ ...keepRange(a, target.y[i]), title: target.y[i].title, unit: target.y[i].unit })) };
}
export function syncCurveStyles(source: Dataset[], targets: Dataset[], styles: Styles, config: PlotConfig, options: SyncOptions): Styles {
  const originals = source.flatMap(f => f.signals.map((_, i) => styles[curveKey(f.id, i)]));
  const next = { ...styles };
  targets.forEach(file => file.signals.forEach((_, i) => {
    const key = curveKey(file.id, i); const old = styles[key]; const reference = originals[i % Math.max(1, originals.length)];
    if (old) next[key] = { ...old, width: reference?.width ?? config.lineWidth, dash: reference?.dash ?? 'solid', panel: reference?.panel ?? 1, ...(options.colors && reference ? { color: reference.color } : {}) };
  }));
  return next;
}
export function curveDefaults(name: string, color: string): CurveStyle { return { name, color, visible: true, width: 1.5, dash: 'solid', showLegend: true, panel: 1 }; }
