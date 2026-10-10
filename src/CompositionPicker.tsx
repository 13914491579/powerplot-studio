import { useState } from 'react';
import type { Dataset } from './parser';
import { applyAssignment, assignmentPlan, selectSources, sourcesFor, type Composition } from './composition';

export default function CompositionPicker({ files, value, onChange, panel, panels }: { files: Dataset[]; value: Composition; onChange: (c: Composition) => void; panel: number; panels: number }) {
  const [mode, setMode] = useState<'file' | 'signal' | null>(null);
  const [partial, setPartial] = useState(false);
  const sources = sourcesFor(files), plan = mode ? assignmentPlan(files, mode) : null;
  const overflow = !!plan && plan.groups.length > panels;
  return <section className="composition-picker" aria-label="跨文件信号选择">
    <h3>子图 {panel} · 数据源</h3>
    <p className="muted">勾选当前子图的信号。同一原始信号可在多个子图使用，样式独立；叠加不同物理量时请检查 Y 轴标题和单位。</p>
    <button className="button secondary full" onClick={() => onChange(selectSources(value, sources.map(s => s.key), panel, false))}>清空当前子图分配</button>
    {files.map((file, index) => {
      const items = sources.filter(s => s.file.id === file.id);
      return <details className="source-file" key={file.id} open><summary>{items[0]?.fileLabel ?? file.filename} · 文件 {index + 1}</summary>
        <button className="text-button" onClick={() => onChange(selectSources(value, items.map(s => s.key), panel, true))}>全选此文件信号</button>
        {items.map(s => <label className="editor-check" key={s.key}><input type="checkbox" aria-label={`文件 ${index + 1} · ${s.signal.name} · 列 ${s.index + 2}`} checked={value.members[s.key]?.includes(panel) ?? false} onChange={e => onChange(selectSources(value, [s.key], panel, e.target.checked))}/>{s.signal.name}<small>列 {s.index + 2}</small></label>)}
      </details>;
    })}
    <h3>快捷分配预览</h3>
    <div className="dimensions"><button className="button secondary" onClick={() => { setMode('file'); setPartial(false); }}>按文件自动分配</button><button className="button secondary" onClick={() => { setMode('signal'); setPartial(false); }}>按信号自动分配</button></div>
    {plan && <div className="assignment-plan" role="region" aria-label="自动分配预览"><p>确认后替换当前可见子图的分配，隐藏子图及实例样式保留。</p>
      {plan.groups.map((g, i) => <div key={i}><strong>{i < panels ? `子图 ${i + 1}` : '超出布局'} · {g.label}</strong><ul>{g.keys.map(key => { const s = sources.find(s => s.key === key)!; return <li key={key}>{s.fileLabel} · {s.signal.name} · 列 {s.index + 2}</li>; })}</ul></div>)}
      {plan.warnings.map(w => <p className="muted" key={w}>{w}</p>)}
      {overflow && <><p role="alert">候选组数 {plan.groups.length} 超过 {panels} 个子图。请增加子图、手动分配，或明确仅分配前几个；未分配数据仍保留。</p><label className="editor-check"><input type="checkbox" checked={partial} onChange={e => setPartial(e.target.checked)}/>仅分配前 {panels} 组</label></>}
      <button className="button primary full" disabled={overflow && !partial} onClick={() => { onChange(applyAssignment(value, plan, panels, partial)); setMode(null); }}>确认应用分配</button>
    </div>}
  </section>;
}
