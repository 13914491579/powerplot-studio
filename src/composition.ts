import type { Dataset } from './parser';
import { COLORS, curveKey, tracesFor, type CurveStyle } from './model';

export interface Composition { members: Record<string, number[]>; styles: Record<string, Partial<CurveStyle>> }
export const emptyComposition = (): Composition => ({ members: {}, styles: {} });
export const instanceKey = (source: string, panel: number) => `${source}@${panel}`;
export const normalizedName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
export function sourcesFor(files: Dataset[]) {
  return files.flatMap((file, fileIndex) => file.signals.map((signal, index) => ({
    file, signal, index, key: curveKey(file.id, index),
    fileLabel: files.filter(f => f.filename === file.filename).length > 1 ? `${file.filename} [${fileIndex + 1}]` : file.filename,
  })));
}
export function instanceStyle(source: ReturnType<typeof sourcesFor>[number], c: Composition, panel: number): CurveStyle {
  return { name: source.signal.name, color: COLORS[source.index % COLORS.length], visible: true, width: 1.5, showLegend: true, ...c.styles[instanceKey(source.key, panel)], panel };
}
export function compositionTraces(files: Dataset[], c: Composition) {
  return sourcesFor(files).flatMap(source => (c.members[source.key] ?? []).map(panel => {
    const key = instanceKey(source.key, panel), style = instanceStyle(source, c, panel);
    const trace = tracesFor([{ ...source.file, signals: [source.signal] }], { [curveKey(source.file.id, 0)]: style }, false)[0];
    return { key, panel, trace: { ...trace, name: `${source.fileLabel} · ${style.name}`, meta: { sourceId: source.key, panel, timeLabel: source.file.timeLabel } } };
  }));
}
export function selectSources(c: Composition, keys: string[], panel: number, selected: boolean): Composition {
  const members = { ...c.members };
  for (const key of keys) members[key] = selected ? [...new Set([...(members[key] ?? []), panel])].sort() : (members[key] ?? []).filter(p => p !== panel);
  return { ...c, members };
}
export function removeSources(c: Composition, fileId: string): Composition {
  return { members: Object.fromEntries(Object.entries(c.members).filter(([key]) => !key.startsWith(fileId + ':'))), styles: Object.fromEntries(Object.entries(c.styles).filter(([key]) => !key.startsWith(fileId + ':'))) };
}
export interface AssignmentPlan { groups: { label: string; keys: string[] }[]; warnings: string[] }
export function assignmentPlan(files: Dataset[], mode: 'file' | 'signal'): AssignmentPlan {
  const sources = sourcesFor(files), warnings: string[] = [];
  if (mode === 'file') return { groups: files.map(f => ({ label: sources.find(s => s.file.id === f.id)?.fileLabel ?? f.filename, keys: sources.filter(s => s.file.id === f.id).map(s => s.key) })), warnings };
  const groups = new Map<string, { label: string; keys: string[] }>();
  for (const s of sources) {
    const name = normalizedName(s.signal.name);
    const duplicate = s.file.signals.filter(signal => normalizedName(signal.name) === name).length > 1;
    const uncertain = s.file.hasHeader === false || duplicate;
    if (uncertain) warnings.push(`${s.fileLabel} · ${s.signal.name}：${duplicate ? '重名表头' : '无表头'}，独立候选，不自动跨文件归类。`);
    const groupKey = uncertain ? 'source:' + s.key : 'header:' + name;
    if (!groups.has(groupKey)) groups.set(groupKey, { label: uncertain ? `${s.fileLabel} · ${s.signal.name}（列 ${s.index + 2}）` : s.signal.name, keys: [] });
    groups.get(groupKey)!.keys.push(s.key);
  }
  for (const group of groups.values()) if (group.keys.length === 1 && files.length > 1) warnings.push(`${group.label}：未匹配其他文件，保留为独立候选；请核对名称和单位。`);
  return { groups: [...groups.values()], warnings: [...new Set(warnings)] };
}
export function applyAssignment(c: Composition, plan: AssignmentPlan, panels: number, partial = false): Composition {
  if (plan.groups.length > panels && !partial) throw new Error('候选组数超过子图数，请增加子图、手动分配或明确选择仅分配前几个。');
  // Only replace visible slots. Inactive slots and their style overrides survive.
  let next = { ...c, members: Object.fromEntries(Object.entries(c.members).map(([key, ps]) => [key, ps.filter(p => p > panels)])) };
  plan.groups.slice(0, panels).forEach((g, i) => { next = selectSources(next, g.keys, i + 1, true); });
  return next;
}
