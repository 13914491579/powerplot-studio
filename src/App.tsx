import { emptyComposition, removeSources, type Composition } from './composition';
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import Editor from './Editor';
import { curveDefaults, defaultConfig, syncConfig, syncCurveStyles, type PlotConfig } from './config';
import { downloadBlob, exportZip, uniqueNames, type Exporter, type Format } from './export';
import { importFile } from './importFile';
import { COLORS, curveKey, type CurveStyle, type Styles } from './model';
import type { Dataset } from './parser';

const ThreeD = lazy(() => import('./ThreeD'));
const Chart = lazy(() => import('./Chart'));

function timeRange(time: number[]) {
  let min = Infinity, max = -Infinity;
  for (const value of time) { min = Math.min(min, value); max = Math.max(max, value); }
  return `${min} — ${max}`;
}
function Logo() { return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M3 19h5l4-12 6 19 4-12h7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

export default function App() {
  const [dimension,setDimension]=useState('2d'),[opened3D,setOpened3D]=useState(false);
  const [files, setFiles] = useState<Dataset[]>([]);
  const [styles, setStyles] = useState<Styles>({});
  const [mode, setMode] = useState<'separate' | 'merged' | 'composition'>('separate');
  const merged = mode !== 'separate';
  const [composition, setComposition] = useState<Composition>(emptyComposition);
  const [configs, setConfigs] = useState<Record<string, PlotConfig>>({ merged: defaultConfig(), composition: defaultConfig() });
  const emptyConfig = useRef(defaultConfig());
  const [selectedId, setSelectedId] = useState('');
  const [exporting, setExporting] = useState(false);
  const exporters = useRef(new Map<string, Exporter>());
  const register = useCallback((id: string, exporter: Exporter | null) => { if (exporter) exporters.current.set(id, exporter); else exporters.current.delete(id); }, []);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const totalCurves = files.reduce((sum, f) => sum + f.signals.length, 0);
  const totalPoints = files.reduce((sum, f) => sum + f.time.length, 0);
  const ranges = useMemo(() => Object.fromEntries(files.map(f => [f.id, timeRange(f.time)])), [files]);
  const groups = useMemo(() => merged ? [{ id: mode, files }] : files.map(f => ({ id: f.id, files: [f] })), [files, mode, merged]);
  const activeId = merged ? mode : files.some(f => f.id === selectedId) ? selectedId : files[0]?.id ?? '';
  const activeFiles = groups.find(g => g.id === activeId)?.files ?? [];
  const config = configs[activeId] ?? emptyConfig.current;
  function changeConfig(next: PlotConfig) {
    setConfigs(previous => ({ ...previous, [activeId || 'merged']: next }));
    if (mode === 'composition') { if (next.lineWidth !== config.lineWidth || next.template !== config.template) setComposition(old => ({ ...old, styles: Object.fromEntries(Object.entries(old.styles).map(([key, style]) => [key, { ...style, width: next.lineWidth }])) })); }
    else if (next.template !== config.template && next.template !== 'custom') activeFiles.forEach(f => f.signals.forEach((_, i) => changeStyle(curveKey(f.id, i), { width: next.lineWidth })));
  }
  async function exportFromPanel(format: Format, all: boolean) {
    if (exporting) return;
    setExporting(true);
    try {
      const selected = (all ? groups : groups.filter(g => g.id === activeId)).map(g => exporters.current.get(g.id));
      if (!selected.length || selected.some(e => !e)) throw new Error('请等待所有图表加载完成。');
      const available = selected as Exporter[];
      if (all) {
        setStatus(`正在批量导出 0/${available.length}`);
        const zip = await exportZip(available, format, done => setStatus(`正在批量导出 ${done}/${available.length}`));
        downloadBlob(zip, `PowerPlot-${format}.zip`);
      } else downloadBlob(await available[0].export(format), uniqueNames([available[0].name], format)[0]);
      setStatus(all ? `已批量导出 ${available.length} 张图表` : '当前图表导出完成');
    } catch (e) { setErrors([e instanceof Error ? e.message : '图片导出失败']); }
    finally { setExporting(false); }
  }
  function syncFormat(colors: boolean, ranges: boolean) {
    const targets = files.filter(f => !activeFiles.some(source => source.id === f.id));
    if (!targets.length) { setStatus('没有其他独立图表可同步，请在分别绘图模式选择源图表。'); return; }
    const displayed = ranges ? exporters.current.get(activeId)?.ranges() : undefined;
    const source = displayed ? { ...config, x: { ...config.x, autoRange: false, min: displayed.x[0], max: displayed.x[1] }, xPanels: config.xPanels.map((a, i) => ({ ...a, autoRange: false, min: displayed.xPanels[i + 1]?.[0] ?? a.min, max: displayed.xPanels[i + 1]?.[1] ?? a.max })), y: config.y.map((a, i) => ({ ...a, autoRange: false, min: displayed.y[i]?.[0] ?? a.min, max: displayed.y[i]?.[1] ?? a.max })) } : config;
    setConfigs(previous => ({ ...previous, ...Object.fromEntries(targets.map(f => [f.id, syncConfig(source, previous[f.id] ?? defaultConfig(), { colors, ranges })])) }));
    setStyles(previous => syncCurveStyles(activeFiles, targets, previous, config, { colors, ranges }));
    setStatus(`已同步格式到 ${targets.length} 张图表，原始数据与曲线名称保留`);
  }

  async function loadFiles(selected: File[]) {
    if (!selected.length || busyRef.current) return;
    busyRef.current = true; setBusy(true); setErrors([]);
    let count = 0;
    const failures: string[] = [];
    for (const [index, file] of selected.entries()) {
      setStatus(`正在读取 ${index + 1}/${selected.length}：${file.name}`);
      try {
        const dataset = await importFile(file);
        setFiles(previous => [...previous, dataset]);
        setStyles(previous => ({ ...previous, ...Object.fromEntries(dataset.signals.map((s, i) => [curveKey(dataset.id, i), curveDefaults(s.name, COLORS[i % COLORS.length])])) }));
        setConfigs(previous => ({ ...previous, [dataset.id]: defaultConfig() }));
        count++;
      } catch (e) { failures.push(`${file.name}：${e instanceof Error ? e.message : '导入失败'}`); }
    }
    setErrors(failures); setStatus(`已导入 ${count} 个文件${failures.length ? `，${failures.length} 个文件失败` : ''}`);
    busyRef.current = false; setBusy(false);
  }

  async function loadExamples() {
    if (busyRef.current) return;
    try {
      const names = ['pscad-real.txt', 'multi-signal.csv'];
      const samples = await Promise.all(names.map(async name => {
        const response = await fetch(`${import.meta.env.BASE_URL}examples/${name}`);
        if (!response.ok) throw new Error('示例文件读取失败。');
        return new File([await response.text()], name, { type: 'text/plain' });
      }));
      await loadFiles(samples);
    } catch (e) { setErrors([e instanceof Error ? e.message : '示例加载失败']); }
  }

  function changeStyle(key: string, patch: Partial<CurveStyle>) {
    setStyles(previous => ({ ...previous, [key]: { ...previous[key], ...patch } }));
  }
  function removeFile(id: string) {
    setFiles(previous => previous.filter(f => f.id !== id));
    setComposition(previous => removeSources(previous, id));
    setStyles(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith(`${id}:`))));
    setConfigs(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== id).map(([key,c]) => { const clean=(l: PlotConfig['legend']) => l.fine ? { ...l, fine: { ...l.fine, positions: Object.fromEntries(Object.entries(l.fine.positions).filter(([k]) => !k.startsWith(id+':'))) } } : l; return [key,{ ...c, legend: clean(c.legend), panelOptions:c.panelOptions.map(p=>({...p,legend:clean(p.legend)})) }]; })));
  }

  return <div className="app-shell" onDragOver={e => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setDragging(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }} onDrop={e => { e.preventDefault(); setDragging(false); void loadFiles(Array.from(e.dataTransfer.files)); }}>
    <header className="topbar">
      <a className="brand" href="./"><span className="brand-icon"><Logo /></span><span>PowerPlot <strong>Studio</strong><small>电力仿真 · 科研波形</small></span><span className="version">2.5 3D</span></a>
      <div className="top-actions"><span className="local-badge"><span />数据仅在本地处理</span><button className="button primary" onClick={() => input.current?.click()} disabled={busy}><span>＋</span> 导入数据</button></div>
      <input ref={input} type="file" multiple accept=".txt,.csv" className="sr-only" aria-label="导入 TXT 或 CSV 文件" onChange={e => { void loadFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
    </header>

    <div className="workspace">
      <aside className={dimension === '3d' ? 'sidebar sidebar-three-d' : 'sidebar'}>
        <section className="panel-section"><div className="section-heading"><h2>数据文件</h2><span className="count">{files.length}</span></div>
          <button className="dropzone" disabled={busy} onClick={() => input.current?.click()}><span className="upload-icon">↑</span><strong>{busy ? '正在解析数据…' : '拖入文件，开始绘图'}</strong><span>TXT / CSV · 支持多个文件</span></button>
          {files.length > 0 ? <ul className="file-list">{files.map(file => <li key={file.id}><span className="file-icon">TXT</span><div><strong title={file.filename}>{file.filename}</strong><small>{file.time.length.toLocaleString()} 个采样点 · {file.signals.length} 条曲线</small><small title={file.timeLabel}>{ranges[file.id]}</small></div><button className="remove-file" onClick={() => removeFile(file.id)} aria-label={`移除 ${file.filename}`} title="移除文件">×</button></li>)}</ul> : <p className="muted compact">支持逗号、Tab、空格分隔的数据。</p>}
        </section>

        <section className="panel-section"><div className="section-heading"><h2>多文件绘图</h2></div><div className="segmented"><button className={mode === 'separate' ? 'active' : ''} onClick={() => setMode('separate')} aria-pressed={mode === 'separate'}>分别绘图</button><button className={mode === 'merged' ? 'active' : ''} onClick={() => setMode('merged')} aria-pressed={mode === 'merged'}>合并绘图</button><button className={mode === 'composition' ? 'active' : ''} onClick={() => setMode('composition')} aria-pressed={mode === 'composition'}>组合绘图</button></div><p className="muted compact">{mode === 'composition' ? '自由选择跨文件信号，组合为一张多子图画布。' : merged ? '叠加所有信号，保留各文件的原始时间。' : '每个文件一张图，多列信号绘制在同一图中。'}</p></section>

        <section className="panel-section"><div className="section-heading"><h2>基础绘图设置</h2></div>
          <label className="field">X 轴标题<input value={config.x.title} placeholder="自动读取时间列名称" onChange={e => changeConfig({ ...config, x: { ...config.x, title: e.target.value }, xPanels: config.xPanels.map(a => ({ ...a, title: e.target.value })) })} /></label>
          <label className="field">Y 轴标题<input value={config.y[0].title} placeholder="自动读取信号名称" onChange={e => changeConfig({ ...config, y: config.y.map((a, i) => i === 0 ? { ...a, title: e.target.value } : a) })} /></label>
          <div className="toggle-row"><label><input type="checkbox" checked={config.x.grid} onChange={e => changeConfig({ ...config, x: { ...config.x, grid: e.target.checked }, xPanels: config.xPanels.map(a => ({ ...a, grid: e.target.checked })), y: config.y.map(a => ({ ...a, grid: e.target.checked })) })} />显示网格</label><label><input type="checkbox" checked={config.legend.show} onChange={e => changeConfig({ ...config, legend: { ...config.legend, show: e.target.checked } })} />显示图例</label></div>
          <button className="button secondary full" onClick={() => setRevision(r => r + 1)} disabled={!files.length}>复位所有图表视图</button>
        </section>
        <div className="sidebar-note"><span className="note-icon">◎</span><p>原始数据完整保留<br/><span>不插值，不滤波，不平滑</span></p></div>
      </aside>

      <main className="preview-pane" style={dimension==='3d'?{gridColumn:'2 / 4'}:undefined}><div className="segmented"><button aria-pressed={dimension === '2d'} onClick={()=>setDimension('2d')}>2D 绘图</button><button aria-pressed={dimension === '3d'} onClick={()=>{setOpened3D(true);setDimension('3d');}}>3D 绘图</button></div>{opened3D && <Suspense fallback={<p>加载 3D 引擎…</p>}><ThreeD files={files} active={dimension === '3d'}/></Suspense>}<div hidden={dimension === '3d'}>
        <div className="workspace-title"><div><span className="eyebrow">WAVEFORM WORKSPACE</span><h1>波形工作区</h1><p>从仿真数据到清晰曲线。</p></div><button className="button secondary" onClick={loadExamples} disabled={busy}>加载示例数据</button></div>
        <div className="summary-bar"><span><b>{merged && files.length ? 1 : files.length}</b> 张图表</span><span><b>{totalCurves}</b> 条曲线</span><span><b>{totalPoints.toLocaleString()}</b> 个时间采样点</span><span className="summary-end">{mode === 'composition' ? '组合视图' : merged ? '合并视图' : '独立视图'}</span></div>
        {status && <div className="status-line" role="status">{busy && <span className="spinner" />}{status}</div>}
        {errors.length > 0 && <div className="error-box" role="alert"><strong>操作未完成</strong>{errors.map((error, i) => <p key={i}>{error}</p>)}<button onClick={() => setErrors([])}>关闭提示</button></div>}
        {!files.length ? <div className="empty-state"><div className="empty-plot"><svg viewBox="0 0 280 100" aria-hidden="true"><path className="mini-grid" d="M0 25h280M0 50h280M0 75h280M40 0v100M90 0v100M140 0v100M190 0v100M240 0v100"/><path className="mini-wave" d="M0 60h55l8-12 7 30 8-61 9 69 10-49 10 21 12-9 13 5 18-3h120"/></svg></div><h2>让仿真数据成为清晰的波形</h2><p>拖入 TXT / CSV 文件，自动识别时间与信号列。<br/>多曲线、多文件，一次导入即可查看。</p><button className="button primary" onClick={() => input.current?.click()} disabled={busy}>＋ 选择数据文件</button><button className="text-button" onClick={loadExamples} disabled={busy}>先体验示例数据 →</button><div className="empty-features"><span>原始时间轴</span><span>交互缩放</span><span>PNG / SVG 导出</span></div></div> : <Suspense fallback={<p className="status-line" role="status">正在加载绘图引擎…</p>}><div className="chart-list">{groups.map(group => <Chart onConfig={next => setConfigs(old => ({ ...old, [group.id]: next }))} key={group.id} id={group.id} files={group.files} styles={styles} merged={merged} composition={mode === 'composition' ? composition : undefined} config={configs[group.id] ?? emptyConfig.current} revision={revision} selected={activeId === group.id} onSelect={() => setSelectedId(group.id)} register={register} onVisibility={(key, visible) => mode === 'composition' ? setComposition(old => ({ ...old, styles: { ...old.styles, [key]: { ...old.styles[key], visible } } })) : changeStyle(key, { visible })} />)}</div></Suspense>}
        <footer className="workspace-footer">PowerPlot Studio · 面向电力系统仿真与科研绘图<span>2.5 / 三维科研排版</span></footer>
      </div></main>

      <aside className="inspector" hidden={dimension === '3d'}>
        <div className="editor-source"><strong>正在编辑</strong><select aria-label="当前图表" value={activeId} onChange={e => setSelectedId(e.target.value)} disabled={!files.length}>{files.length ? groups.map(g => <option key={g.id} value={g.id}>{g.id === 'composition' ? '跨文件组合波形' : g.id === 'merged' ? '合并波形' : g.files[0].filename}</option>) : <option value="">请先导入数据</option>}</select></div>
        <Editor key={activeId} composition={mode === 'composition' ? composition : undefined} onComposition={setComposition} config={config} onChange={changeConfig} files={activeFiles} styles={styles} changeStyle={changeStyle} exporting={exporting} exportCurrent={format => { void exportFromPanel(format, false); }} exportAll={format => { void exportFromPanel(format, true); }} sync={syncFormat} />
      </aside>
    </div>
    {dragging && <div className="drag-overlay"><div><span>↓</span><h2>释放文件，自动生成曲线</h2><p>支持 TXT / CSV · 所有数据仅在浏览器处理</p></div></div>}
  </div>;
}




