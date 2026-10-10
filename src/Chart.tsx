import { type Composition } from './composition';
import { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-basic-dist-min';
import type { PlotlyHTMLElement, PlotData } from 'plotly.js';
import type { Dataset } from './parser';
import { type Styles } from './model';
import { validateConfig, xFor, type PlotConfig } from './config';
import { buildFigure } from './layout';
import { downloadBlob, exportChart, uniqueNames, type Exporter, type Format } from './export';

interface Props {
  id: string; files: Dataset[]; styles: Styles; merged: boolean; config: PlotConfig; revision: number; composition?: Composition;
  selected: boolean; onSelect: () => void;
  register: (id: string, exporter: Exporter | null) => void;
  onVisibility: (key: string, visible: boolean) => void;
}

export default function Chart({ id, files, styles, merged, config, revision, onVisibility, selected, onSelect, register, composition }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const alive = useRef(false);
  const visibilityHandler = useRef(onVisibility);
  visibilityHandler.current = onVisibility;
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(600);
  const [geometry, setGeometry] = useState({ width: 336, height: 211.2 });
  const viewport = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const plotWidth = geometry.width, plotHeight = geometry.height;
  const scale = viewportWidth / plotWidth;
  const keysRef = useRef<string[]>([]);
  const title = composition ? '跨文件组合波形' : merged ? '合并波形' : files[0].filename;
  const curveCount = files.reduce((n, f) => n + f.signals.length, 0);

  useEffect(() => {
    alive.current = true;
    const div = element.current!;
    const observer = new ResizeObserver(() => {
      if (viewport.current && alive.current) setViewportWidth(viewport.current.clientWidth);
    });
    observer.observe(viewport.current!);
    return () => {
      alive.current = false;
      observer.disconnect();
      queue.current = queue.current.catch(() => {}).then(() => Plotly.purge(div));
    };
  }, []);

  useEffect(() => {
    const div = element.current!;
    let cancelled = false;
    setReady(false);
    readyRef.current = false;
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (cancelled || !alive.current) return;
      const invalid = validateConfig(config); if (invalid.length) throw new Error(invalid.join(' '));
      const { traces, emptyTraces, layout, keys, width, height } = buildFigure(files, styles, merged, config, revision, composition);
      keysRef.current = keys;
      if (config.font.family === 'Noto Sans SC') await document.fonts.load('16px "Noto Sans SC"');
      const gd = await Plotly.react(div, [...traces, ...emptyTraces], layout, {
        responsive: false, displaylogo: false, scrollZoom: true,
        modeBarButtonsToRemove: ['toImage', 'select2d', 'lasso2d'],
        doubleClick: 'reset',
        showTips: false,
      });
      // Keep the curve controls and legend clicks in one state.
      gd.removeAllListeners('plotly_legendclick');
      gd.removeAllListeners('plotly_legenddoubleclick');
      gd.on('plotly_legendclick', (event) => {
        const key = keysRef.current[event.curveNumber];
        visibilityHandler.current(key, (event.data[event.curveNumber] as Partial<PlotData>).visible === 'legendonly');
        return false;
      });
      gd.on('plotly_legenddoubleclick', () => false);
      if (!cancelled && alive.current) { setGeometry({ width, height }); readyRef.current = true; setReady(true); setError(''); }
    }).catch(e => { if (!cancelled && alive.current) setError(`绘图失败：${e instanceof Error ? e.message : String(e)}`); });
    return () => { cancelled = true; };
  }, [styles, config, merged, files, revision, composition]);

  useEffect(() => {
    register(id, { name: composition ? 'PowerPlot-组合波形' : merged ? 'PowerPlot-合并波形' : files[0].filename, ranges: () => {
      const layout = (element.current as unknown as PlotlyHTMLElement)?.layout as unknown as Record<string, { range?: number[] }>;
      return { x: layout?.xaxis?.range ?? [config.x.min, config.x.max], xPanels: Array.from({ length: 4 }, (_, i) => layout?.[`xaxis${i ? i + 1 : ''}`]?.range ?? [xFor(config, i).min, xFor(config, i).max]), y: config.y.map((a, i) => layout?.[`yaxis${i ? i + 1 : ''}`]?.range ?? [a.min, a.max]) };
    }, export: async format => {
      await queue.current;
      if (!readyRef.current || !element.current) throw new Error(`${title}：图表尚未就绪或参数无效。`);
      return exportChart(element.current as unknown as PlotlyHTMLElement, config, format);
    } });
    return () => register(id, null);
  }, [config, id, title, files, merged, register, composition]);

  async function download(format: Format) {
    if (!ready || !element.current) return;
    setExporting(true);
    setError('');
    try {
      await queue.current;
      const gd = element.current as unknown as PlotlyHTMLElement;
      const blob = await exportChart(gd, config, format);
      downloadBlob(blob, uniqueNames([composition ? 'PowerPlot-组合波形' : merged ? 'PowerPlot-合并波形' : files[0].filename], format)[0]);
    } catch (e) { setError(`导出失败：${e instanceof Error ? e.message : String(e)}`); }
    finally { setExporting(false); }
  }

  return <article className={`chart-card ${selected ? 'selected-chart' : ''}`}>
    <header className="chart-header"><div><span className="chart-dot" /><h3>{title}</h3><span className="tag">{curveCount} 条曲线</span></div>
      <div className="chart-actions"><button disabled={!ready || exporting} onClick={() => download('png')}>{exporting ? '导出中…' : '↓ PNG'}</button><button disabled={!ready || exporting} onClick={() => download('svg')}>↓ SVG</button><button disabled={!ready || exporting} onClick={() => download('pdf')}>↓ PDF</button><button onClick={onSelect} aria-pressed={selected}>编辑</button></div>
    </header>
    <div ref={viewport} className="plot-viewport" style={{ height: plotHeight * scale }}><div ref={element} className="plot-area" style={{ width: plotWidth, height: plotHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }} aria-label={`${title} 波形预览`} /></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {(composition ? Object.values(composition.members).some(ps => ps.some(p => p > config.panels)) : files.some(f => f.signals.some((_, i) => (styles[`${f.id}:${i}`]?.panel ?? 1) > config.panels))) && <p className="status-line" role="status">部分曲线所属子图超出当前布局，暂不显示。分配及数据保留，增加子图后恢复。</p>}
    <footer className="chart-footer"><span>原始采样 · 无插值 / 无平滑</span><span>拖动缩放 · 滚轮缩放 · 双击复位</span></footer>
  </article>;
}
