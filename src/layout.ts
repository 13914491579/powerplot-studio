import type { Layout, Axis, Annotations } from 'plotly.js';
import type { Dataset } from './parser';
import { curveKey, tracesFor, type Styles } from './model';
import { dataExtent, inches, gridShape, xFor, type AxisConfig, type PlotConfig } from './config';
const px = (pt: number) => pt * 96 / 72;
export function buildFigure(files: Dataset[], styles: Styles, merged: boolean, config: PlotConfig, revision: number) {
  const size = inches(config.size); const width = size.width * 96, height = size.height * 96;
  const allRaw = tracesFor(files, styles, merged);
  const allKeys = files.flatMap(f => f.signals.map((_, i) => curveKey(f.id, i)));
  const active = allRaw.map((_, i) => i).filter(i => (styles[allKeys[i]]?.panel ?? 1) <= config.panels);
  const raw = active.map(i => allRaw[i]);
  if (raw.some(t => !Number.isFinite(t.line.width) || t.line.width < .1 * 96 / 72 || t.line.width > 10 * 96 / 72)) throw new Error('曲线线宽需在 0.1–10 pt 之间。');
  const keys = active.map(i => allKeys[i]);
  const panels = raw.map((_, i) => styles[keys[i]]?.panel ?? 1);
  const traces = raw.map((trace, i) => ({ ...trace, xaxis: panels[i] === 1 ? 'x' : `x${panels[i]}`, yaxis: panels[i] === 1 ? 'y' : `y${panels[i]}`, legend: config.legendMode === 'panel' ? (panels[i] === 1 ? 'legend' : `legend${panels[i]}`) : 'legend', showlegend: trace.showlegend && (config.legendMode === 'panel' ? config.panelOptions[panels[i] - 1].legend.show : config.legend.show) }));
  const autoX = new Set(files.map(f => f.timeLabel)).size === 1 ? files[0].timeLabel : '时间（各文件原始单位）';
  function* allTime() { for (const file of files) yield* file.time; }
  const xExtent = dataExtent(allTime());
  const axisLayout = (a: AxisConfig, extent: [number, number], title: string): Partial<Axis> & { griddash: string; automargin: boolean; ticklabelstandoff: number } => {
    const range: [number, number] = a.autoRange ? extent : [a.min, a.max];
    const interval = a.ticks === 'interval' ? a.interval : undefined;
    if (interval && (range[1] - range[0]) / interval > 1000) throw new Error('主刻度数量超过 1000，请增大间隔。');
    return { range, autorange: false, title: { text: (a.title || title) + (a.unit ? ` / ${a.unit}` : ''), font: { size: px(config.font.axis) }, standoff: px(config.spacing.axisTitle) },
      tickfont: { size: px(config.font.tick) }, tickmode: a.ticks === 'count' ? 'array' : a.ticks === 'interval' ? 'linear' : 'auto',
      ...(a.ticks === 'count' ? { tickvals: Array.from({ length: a.count }, (_, i) => range[0] + (range[1] - range[0]) * i / (a.count - 1)) } : {}),
      dtick: interval, tick0: 0, tickformat: a.decimals === null ? undefined : `.${a.decimals}f`,
      showgrid: a.grid, gridcolor: a.gridColor, gridwidth: px(a.gridWidth), griddash: a.gridDash,
      zeroline: false, showline: true, linecolor: a.lineColor, linewidth: px(a.lineWidth), ticks: 'outside', ticklen: 3, ticklabelstandoff: px(config.spacing.tick), automargin: true };
  };
  const legendItems = traces.filter(t => t.showlegend);
  const textWidth = (text: string) => Array.from(text).reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 1 : .53), 0) * px(config.font.legend) + 38;
  const innerWidth = width - px(config.margin.l + config.margin.r);
  let legendRows = 1, used = 0;
  for (const trace of legendItems) { const item = Math.min(innerWidth, textWidth(trace.name)); if (used > 0 && used + item > innerWidth) { legendRows++; used = 0; } used += item; }
  const legendHeight = config.legend.orientation === 'v' ? legendItems.length * (px(config.font.legend) + 5) : legendRows * (px(config.font.legend) + 5);
  const margin = Object.fromEntries(Object.entries(config.margin).map(([k, v]) => [k, px(v)])) as { l: number; r: number; t: number; b: number };
  if (config.title) margin.t += px(config.font.title) + 8;
  const external = config.legendMode === 'global' && config.legend.show && legendItems.length > 0;
  if (external && ['top', 'bottom'].includes(config.legend.position)) margin[config.legend.position === 'top' ? 't' : 'b'] += legendHeight + 8;
  if (external && ['left', 'right'].includes(config.legend.position)) margin[config.legend.position === 'left' ? 'l' : 'r'] += Math.max(...legendItems.map(t => textWidth(t.name))) + 8;
  const { rows, columns } = gridShape(config);
  const panelLegendHeight = config.legendMode === 'panel' && config.legend.show ? Math.max(0, ...config.panelOptions.slice(0, config.panels).map((p, i) => {
    const items = traces.filter((t, j) => panels[j] === i + 1 && t.showlegend);
    if (!p.legend.show || !['top','bottom'].includes(p.legend.position)) return 0;
    const available = (width - margin.l - margin.r) / columns;
    return (px(p.legend.fontSize ?? config.font.legend) + 5) * (p.legend.orientation === 'v' ? items.length : Math.max(1, Math.ceil(items.reduce((sum, t) => sum + textWidth(t.name), 0) / Math.max(70, available)))) + 8;
  })) : 0;
  if (panelLegendHeight) { margin.t += panelLegendHeight; margin.b += panelLegendHeight; }
  const sideLegendWidth = config.legendMode === 'panel' && config.legend.show ? Math.max(0, ...config.panelOptions.slice(0, config.panels).map((p, i) => p.legend.show && ['left','right'].includes(p.legend.position) ? Math.max(0, ...traces.filter((t, j) => panels[j] === i + 1 && t.showlegend).map(t => textWidth(t.name))) + 8 : 0)) : 0;
  if (sideLegendWidth) { margin.l += sideLegendWidth; margin.r += sideLegendWidth; }
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
    uirevision: JSON.stringify([files.map(f => f.id), revision, config.panels, columns, config.sharedX, config.xSync, config.hideRepeatedX, [config.x, ...config.xPanels, ...config.y].map(a => [a.autoRange, a.min, a.max])]),
  };
  const availableHeight = height - margin.t - margin.b;
  const availableWidth = width - margin.l - margin.r;
  const sync = config.sharedX ? config.xSync === 'independent' ? 'all' : config.xSync : 'independent';
  const hideX = config.hideRepeatedX && sync !== 'independent';
  const gapY = px(config.spacing.vertical + (hideX ? 0 : config.font.tick + config.font.axis + config.spacing.axisTitle + config.spacing.tick)) + panelLegendHeight;
  // Each internal column must reserve its own Y title and tick labels.
  const gapX = px(config.spacing.horizontal + config.font.axis + config.font.tick * 4 + config.spacing.axisTitle + config.spacing.tick) + sideLegendWidth;
  const cellWidth = (availableWidth - gapX * (columns - 1)) / columns;
  const cellHeight = (availableHeight - gapY * (rows - 1)) / rows;
  if (cellWidth < Math.max(70, px(config.font.tick) * 6) || cellHeight < 55) throw new Error('子图可用绘图区过小：请扩大画布宽度/高度、缩小字号或减少间距。不会自动改变导出尺寸。');
  const annotations: NonNullable<Layout['annotations']> = [];
  for (let i = 0; i < config.panels; i++) {
    const n = i + 1; const suffix = i === 0 ? '' : String(n);
    function* values() { for (const [j, trace] of raw.entries()) if (panels[j] === n && trace.visible === true) yield* trace.y; }
    const names = raw.filter((_, j) => panels[j] === n);
    const y = axisLayout(config.y[i], dataExtent(values(), true), names.length === 1 ? names[0].name : `信号值${config.panels > 1 ? ` ${n}` : ''}`);
    const row = Math.floor(i / columns), col = i % columns;
    const group = sync === 'all' ? 0 : sync === 'column' ? col : i;
    function* groupTime() { for (const [j, trace] of raw.entries()) if (sync === 'all' || (sync === 'column' ? (panels[j] - 1) % columns === col : panels[j] === n)) yield* trace.x; }
    const x = axisLayout(xFor(config, group), raw.length ? dataExtent(groupTime()) : xExtent, autoX);
    // Synchronizing ranges never implicitly hides titles or ticks.
    const independentStyle = xFor(config, i);
    const ownX = axisLayout(independentStyle, xExtent, autoX);
    const xDomain: [number, number] = [col * (cellWidth + gapX) / availableWidth, (col * (cellWidth + gapX) + cellWidth) / availableWidth];
    const top = 1 - row * (cellHeight + gapY) / availableHeight;
    const yDomain: [number, number] = [Math.max(0, top - cellHeight / availableHeight), top];
    layout[`yaxis${suffix}`] = { ...y, domain: yDomain, anchor: `x${suffix}` };
    const showX = !hideX || row === rows - 1;
    const titleLength = (text: string) => Array.from(text).reduce((sum, ch) => sum + (ch.charCodeAt(0) > 255 ? 1 : .53), 0) * px(config.font.axis);
    if ((showX && titleLength(String(ownX.title?.text ?? '')) > cellWidth) || titleLength(String(y.title?.text ?? '')) > cellHeight) throw new Error(`子图 ${n} 轴标题过长：请扩大画布、缩小字号或缩短标题。`);
    layout[`xaxis${suffix}`] = { ...ownX, range: x.range, anchor: `y${suffix}`, domain: xDomain, matches: group === i ? undefined : group === 0 ? 'x' : `x${group + 1}`, showticklabels: showX, title: showX ? ownX.title : { text: '' } };
    const p = config.panelOptions[i];
    if (config.panels > 1 && p.showLabel) annotations.push({ text: p.label, xref: `x${suffix} domain` as Annotations['xref'], yref: `y${suffix} domain` as Annotations['yref'], x: p.x, y: p.y, xanchor: p.x <= .5 ? 'left' : 'right', yanchor: p.y >= .5 ? 'top' : 'bottom', showarrow: false, font: { size: px(p.fontSize), color: config.font.color }, bgcolor: 'rgba(255,255,255,0.8)' });
    if (config.legendMode === 'panel') {
      const l = p.legend, left = xDomain[0], right = xDomain[1], bottom = yDomain[0];
      const positions = {
        top: { x: left, y: top + panelLegendHeight / availableHeight, xanchor: 'left', yanchor: 'top' },
        bottom: { x: left, y: bottom - px(config.font.axis + config.font.tick + config.spacing.axisTitle + config.spacing.tick) / availableHeight, xanchor: 'left', yanchor: 'top' },
        left: { x: left - px(config.font.axis + config.font.tick * 4 + config.spacing.axisTitle) / availableWidth, y: top, xanchor: 'right', yanchor: 'top' },
        right: { x: right + 8 / availableWidth, y: top, xanchor: 'left', yanchor: 'top' },
        inside: { x: right, y: top, xanchor: 'right', yanchor: 'top' },
        manual: { x: left + l.x * (right - left), y: bottom + l.y * (top - bottom), xanchor: 'left', yanchor: 'top' },
      }[l.position];
      layout[i === 0 ? 'legend' : `legend${n}`] = { ...positions, xref: 'paper', yref: 'paper', orientation: l.orientation, font: { size: px(l.fontSize ?? config.font.legend) }, borderwidth: l.border ? .7 : 0, bordercolor: config.font.color, bgcolor: `rgba(255,255,255,${l.opacity})`, tracegroupgap: 3 };
    }
  }
  layout.annotations = annotations;
  // Plotly drops axes without a trace. Null-only render placeholders create no
  // waveform points and never enter the parsed datasets or editable curve list.
  const emptyTraces = Array.from({ length: config.panels }, (_, i) => i + 1).filter(n => !panels.includes(n)).map(n => ({ x: [null], y: [null], type: 'scatter' as const, mode: 'lines' as const, showlegend: false, hoverinfo: 'skip' as const, meta: { emptyPanel: true }, xaxis: n === 1 ? 'x' : `x${n}`, yaxis: n === 1 ? 'y' : `y${n}` }));
  return { traces, emptyTraces, layout, width, height, keys };
}
