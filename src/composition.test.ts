import { describe, it, expect } from 'vitest';
import { parseText, type Dataset } from './parser';
import { applyAssignment, assignmentPlan, compositionTraces, emptyComposition, instanceKey, removeSources, selectSources } from './composition';
import { buildFigure } from './layout';
import { changeLayout, defaultConfig } from './config';
const files: Dataset[] = ['A','B','C'].map((id, i) => ({ ...parseText(`Time/s,P/pu,Udc/pu,Idc/pu\n${1 + i},1,2,3\n${1.001 + i},999,4,5\n${1.8 + i},6,7,8`), id, filename: id + '.txt' }));
describe('跨文件组合', () => {
  it('按导入顺序将三个文件全部信号分配给三张子图', () => {
    const c = applyAssignment(emptyComposition(), assignmentPlan(files, 'file'), 3);
    expect(compositionTraces(files, c).map(t => t.panel)).toEqual([1,1,1,2,2,2,3,3,3]);
  });
  it('规范化完整表头匹配，保留原名及单位，不猜测别名', () => {
    const other = { ...files[1], signals: files[1].signals.map((s, i) => ({ ...s, name: i === 0 ? ' Ｐ/pu ' : s.name })) };
    const plan = assignmentPlan([files[0], other, files[2]], 'signal');
    expect(plan.groups).toHaveLength(3); expect(plan.groups[0].keys).toEqual(['A:0','B:0','C:0']);
    expect(other.signals[0].name).toBe(' Ｐ/pu ');
  });
  it('不同长度、非顺序与非等间隔数组按引用保留，尖峰不丢失', () => {
    const other = { ...files[1], time: [5,5.9,5.2,6], signals: [{ name: 'P', values: [0,9999,-3,4] }] };
    const c = selectSources(emptyComposition(), ['A:0','B:0'], 1, true);
    const rows = compositionTraces([files[0], other], c);
    expect(rows[0].trace.x).toBe(files[0].time); expect(rows[1].trace.x).toBe(other.time); expect(rows[1].trace.y).toBe(other.signals[0].values);
    expect(rows[1].trace.line.simplify).toBe(false); expect(rows[1].trace.y).toContain(9999);
  });
  it('同一源多个实例独立样式，图例拥有稳定实例 ID', () => {
    let c = selectSources(emptyComposition(), ['A:0'], 1, true); c = selectSources(c, ['A:0'], 3, true);
    c.styles[instanceKey('A:0',3)] = { name: 'Other', color: '#000000', visible: false };
    const rows = compositionTraces(files,c); expect(rows.map(r=>r.key)).toEqual(['A:0@1','A:0@3']); expect(rows[0].trace.x).toBe(rows[1].trace.x);
    expect(rows[0].trace.name).toContain('P/pu'); expect(rows[1].trace.name).toContain('Other'); expect(rows[1].trace.visible).toBe('legendonly');
  });
  it('同名文件通过 ID 区分，删除只清理目标文件的引用和样式', () => {
    const same = files.map(f=>({...f,filename:'same.txt'})); let c = applyAssignment(emptyComposition(),assignmentPlan(same,'file'),3); c.styles['B:0@2']={color:'#000000'};
    expect(compositionTraces(same,c)[0].trace.name).toContain('[1]'); expect(compositionTraces(same,c)[3].trace.name).toContain('[2]');
    c=removeSources(c,'B'); expect(c.styles).toEqual({}); expect(Object.keys(c.members)).toEqual(['A:0','A:1','A:2','C:0','C:1','C:2']);
  });
  it('重名和无表头不跨文件猜测匹配，并明确提示', () => {
    const missing={...parseText('1,2,3\n2,3,4'),id:'missing',filename:'missing.txt'};
    const duplicate={...files[0],signals:[files[0].signals[0],files[0].signals[0]]};
    const plan=assignmentPlan([duplicate,missing],'signal'); expect(plan.groups).toHaveLength(4); expect(plan.groups.every(g=>g.keys.length===1)).toBe(true); expect(plan.warnings.join()).toContain('无表头'); expect(plan.warnings.join()).toContain('重名');
  });
  it('超过布局必须明确选择部分分配，隐藏槽位保留', () => {
    const old=selectSources(emptyComposition(),['C:0'],4,true), plan=assignmentPlan(files,'file');
    expect(()=>applyAssignment(old,plan,2)).toThrow('超过'); const next=applyAssignment(old,plan,2,true); expect(next.members['C:0']).toEqual([4]); expect(next.members['B:0']).toEqual([2]);
  });
  it('缩减恢复、原有分别合并管线和组合模式互不影响', () => {
    const c=applyAssignment(emptyComposition(),assignmentPlan(files,'signal'),3), base=defaultConfig(), grid=changeLayout(base,1,3);
    expect(buildFigure(files,{},true,grid,0,c).traces).toHaveLength(9);
    expect(buildFigure(files,{},true,base,0,c).traces).toHaveLength(3);
    expect(buildFigure(files,{},true,grid,0,c).traces).toHaveLength(9);
    expect(buildFigure([files[0]],{},false,base,0).traces).toHaveLength(3); expect(buildFigure(files,{},true,base,0).traces).toHaveLength(9);
  });
});
