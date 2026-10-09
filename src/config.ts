import type { Dataset } from './parser';
import { curveKey, type Styles, type CurveStyle } from './model';

export type Dash = 'solid' | 'dash' | 'dot' | 'dashdot';
export interface AxisConfig {
  title: string; autoRange: boolean; min: number; max: number;
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
  legend: { show: boolean; position: 'top' | 'bottom' | 'left' | 'right' | 'inside' | 'manual'; orientation: 'h' | 'v'; border: boolean; opacity: number; x: number; y: number };
  panels: 1 | 2 | 3; sharedX: boolean; lineWidth: number;
}
const axis = (): AxisConfig => ({ title: '', autoRange: true, min: 0, max: 1, ticks: 'auto', interval: .1, count: 5, decimals: null, grid: true, gridColor: '#e8edf3', gridWidth: .5, gridDash: 'solid', lineColor: '#64748b', lineWidth: .65 });
export function defaultConfig(): PlotConfig {
  return { mode: 'paper', template: 'single', size: { unit: 'inch', width: 3.5, height: 2.2, dpi: 600 }, x: axis(), y: [axis(), axis(), axis()], font: { family: 'Times New Roman', color: '#233047', axis: 9, tick: 8, legend: 8, title: 10 }, title: '', margin: { l: 42, r: 10, t: 16, b: 32 }, legend: { show: true, position: 'top', orientation: 'h', border: false, opacity: 0, x: 0, y: 1 }, panels: 1, sharedX: true, lineWidth: 1.5 };
}
export function inches(size: PlotConfig['size']) { return { width: size.width / (size.unit === 'mm' ? 25.4 : 1), height: size.height / (size.unit === 'mm' ? 25.4 : 1) }; }
export function pixelSize(size: PlotConfig['size']) { const s = inches(size); return { width: Math.round(s.width * size.dpi), height: Math.round(s.height * size.dpi) }; }
export function applyTemplate(config: PlotConfig, template: PlotConfig['template']): PlotConfig {
  if (template === 'custom') return { ...config, template };
  const base = defaultConfig();
  return { ...config, mode: 'paper', template, font: base.font, margin: base.margin, legend: base.legend, lineWidth: 1.5,
    size: { ...config.size, unit: 'inch', width: template === 'single' ? 3.5 : 7.16, height: config.panels === 1 ? (template === 'single' ? 2.2 : 3.6) : config.panels * 1.5 },
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
  [c.x, ...c.y.slice(0, c.panels)].forEach((a, index) => {
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
  return { ...structuredClone(source), title: target.title, x: { ...keepRange(source.x, target.x), title: target.x.title }, y: source.y.map((a, i) => ({ ...keepRange(a, target.y[i]), title: target.y[i].title })) };
}
export function syncCurveStyles(source: Dataset[], targets: Dataset[], styles: Styles, config: PlotConfig, options: SyncOptions): Styles {
  const originals = source.flatMap(f => f.signals.map((_, i) => styles[curveKey(f.id, i)]));
  const next = { ...styles };
  targets.forEach(file => file.signals.forEach((_, i) => {
    const key = curveKey(file.id, i); const old = styles[key]; const reference = originals[i % Math.max(1, originals.length)];
    if (old) next[key] = { ...old, width: reference?.width ?? config.lineWidth, dash: reference?.dash ?? 'solid', panel: Math.min(config.panels, reference?.panel ?? 1), ...(options.colors && reference ? { color: reference.color } : {}) };
  }));
  return next;
}
export function curveDefaults(name: string, color: string): CurveStyle { return { name, color, visible: true, width: 1.5, dash: 'solid', showLegend: true, panel: 1 }; }
