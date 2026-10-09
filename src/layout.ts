import type { Layout, Axis } from 'plotly.js';
import type { Dataset } from './parser';
import { curveKey, tracesFor, type Styles } from './model';
import { dataExtent, inches, type AxisConfig, type PlotConfig } from './config';
const px = (pt: number) => pt * 96 / 72;
export function buildFigure(files: Dataset[], styles: Styles, merged: boolean, config: PlotConfig, revision: number) {
  const size = inches(config.size); const width = size.width * 96, height = size.height * 96;
  const raw = tracesFor(files, styles, merged);
  if (raw.some(t => !Number.isFinite(t.line.width) || t.line.width < .1 * 96 / 72 || t.line.width > 10 * 96 / 72)) throw new Error('曲线线宽需在 0.1–10 pt 之间。');
  const keys = files.flatMap(f => f.signals.map((_, i) => curveKey(f.id, i)));
  const panels = raw.map((_, i) => Math.min(config.panels, styles[keys[i]]?.panel ?? 1));
  const traces = raw.map((trace, i) => ({ ...trace, xaxis: panels[i] === 1 ? 'x' : `x${panels[i]}`, yaxis: panels[i] === 1 ? 'y' : `y${panels[i]}` }));
  const autoX = new Set(files.map(f => f.timeLabel)).size === 1 ? files[0].timeLabel : '时间（各文件原始单位）';
  function* allTime() { for (const file of files) yield* file.time; }
  const xExtent = dataExtent(allTime());
  const axisLayout = (a: AxisConfig, extent: [number, number], title: string): Partial<Axis> & { griddash: string; automargin: boolean } => {
    const range: [number, number] = a.autoRange ? extent : [a.min, a.max];
    const interval = a.ticks === 'interval' ? a.interval : undefined;
    if (interval && (range[1] - range[0]) / interval > 1000) throw new Error('主刻度数量超过 1000，请增大间隔。');
    return { range, autorange: false, title: { text: a.title || title, font: { size: px(config.font.axis) }, standoff: 6 },
      tickfont: { size: px(config.font.tick) }, tickmode: a.ticks === 'count' ? 'array' : a.ticks === 'interval' ? 'linear' : 'auto',
      ...(a.ticks === 'count' ? { tickvals: Array.from({ length: a.count }, (_, i) => range[0] + (range[1] - range[0]) * i / (a.count - 1)) } : {}),
      dtick: interval, tick0: 0, tickformat: a.decimals === null ? undefined : `.${a.decimals}f`,
      showgrid: a.grid, gridcolor: a.gridColor, gridwidth: px(a.gridWidth), griddash: a.gridDash,
      zeroline: false, showline: true, linecolor: a.lineColor, linewidth: px(a.lineWidth), ticks: 'outside', ticklen: 3, automargin: true };
  };
  const legendItems = traces.filter(t => t.showlegend);
  const textWidth = (text: string) => Array.from(text).reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 1 : .53), 0) * px(config.font.legend) + 38;
  const innerWidth = width - px(config.margin.l + config.margin.r);
  let legendRows = 1, used = 0;
  for (const trace of legendItems) { const item = Math.min(innerWidth, textWidth(trace.name)); if (used > 0 && used + item > innerWidth) { legendRows++; used = 0; } used += item; }
  const legendHeight = config.legend.orientation === 'v' ? legendItems.length * (px(config.font.legend) + 5) : legendRows * (px(config.font.legend) + 5);
  const margin = Object.fromEntries(Object.entries(config.margin).map(([k, v]) => [k, px(v)])) as { l: number; r: number; t: number; b: number };
  if (config.title) margin.t += px(config.font.title) + 8;
  const external = config.legend.show && legendItems.length > 0;
  if (external && ['top', 'bottom'].includes(config.legend.position)) margin[config.legend.position === 'top' ? 't' : 'b'] += legendHeight + 8;
  if (external && ['left', 'right'].includes(config.legend.position)) margin[config.legend.position === 'left' ? 'l' : 'r'] += Math.max(...legendItems.map(t => textWidth(t.name))) + 8;
  if (width - margin.l - margin.r < 70 || (height - margin.t - margin.b) / config.panels < 42) throw new Error('可用绘图区过小，请增大物理尺寸、减少边距或调整图例布局。');
  const legendPosition = {
    top: { x: 0, y: 1 - (config.title ? px(config.font.title) + 15 : 4) / height, xanchor: 'left' as const, yanchor: 'top' as const, yref: 'container' as const },
    bottom: { x: 0, y: .01, xanchor: 'left' as const, yanchor: 'bottom' as const, yref: 'container' as const },
    left: { x: .01, y: 1, xanchor: 'left' as const, yanchor: 'top' as const, xref: 'container' as const },
    right: { x: .99, y: 1, xanchor: 'right' as const, yanchor: 'top' as const, xref: 'container' as const },
    inside: { x: .98, y: .98, xanchor: 'right' as const, yanchor: 'top' as const },
    manual: { x: config.legend.x, y: config.legend.y, xanchor: 'left' as const, yanchor: 'top' as const },
  }[config.legend.position];
  const layout: Partial<Layout> & Record<string, unknown> = {
    autosize: false, width, height, paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff', margin,
    font: { family: config.font.family, color: config.font.color, size: px(config.font.tick) },
    title: { text: config.title, font: { size: px(config.font.title) }, x: .5, xanchor: 'center', y: .98 },
    showlegend: config.legend.show, legend: { ...legendPosition, orientation: config.legend.orientation, font: { size: px(config.font.legend) }, borderwidth: config.legend.border ? .7 : 0, bordercolor: config.font.color, bgcolor: `rgba(255,255,255,${config.legend.opacity})`, tracegroupgap: 3 },
    hovermode: 'x unified', dragmode: 'zoom',
    uirevision: JSON.stringify([files.map(f => f.id), revision, config.panels, config.sharedX, [config.x, ...config.y].map(a => [a.autoRange, a.min, a.max])]),
  };
  const availableHeight = height - margin.t - margin.b;
  const gap = config.panels > 1 ? (config.sharedX ? Math.max(14, px(config.font.tick) * 1.2) : px(config.font.tick + config.font.axis) + 14) / availableHeight : 0;
  const panelHeight = (1 - gap * (config.panels - 1)) / config.panels;
  if (panelHeight * availableHeight < 42) throw new Error('子图标签需要更多空间，请增加图片高度或减小字号。');
  for (let i = 0; i < config.panels; i++) {
    const n = i + 1; const suffix = i === 0 ? '' : String(n);
    function* values() { for (const [j, trace] of raw.entries()) if (panels[j] === n && trace.visible === true) yield* trace.y; }
    const names = raw.filter((_, j) => panels[j] === n);
    const y = axisLayout(config.y[i], dataExtent(values(), true), names.length === 1 ? names[0].name : `信号值${config.panels > 1 ? ` ${n}` : ''}`);
    const x = axisLayout(config.x, xExtent, autoX);
    const bottom = 1 - panelHeight * n - gap * i;
    layout[`yaxis${suffix}`] = { ...y, domain: [Math.max(0, bottom), bottom + panelHeight], anchor: `x${suffix}` };
    layout[`xaxis${suffix}`] = { ...x, anchor: `y${suffix}`, domain: [0, 1], ...(config.sharedX ? { matches: i ? 'x' : undefined, showticklabels: i === config.panels - 1, title: i === config.panels - 1 ? x.title : { text: '' } } : {}) };
  }
  return { traces, layout, width, height, keys };
}
