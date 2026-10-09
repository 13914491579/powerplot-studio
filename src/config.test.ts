import { describe, expect, it } from 'vitest';
import { applyTemplate, defaultConfig, pixelSize, syncConfig, syncCurveStyles, validateConfig, curveDefaults } from './config';
import { buildFigure } from './layout';
import { parseText } from './parser';
import { curveKey, COLORS } from './model';
import { uniqueNames } from './export';
import { withDpi } from './png';

const file = { ...parseText('Time/s,A,B,C\n1.4,0,2,3\n1.4001,99,-5,7\n1.9,1,4,6'), id: 'one', filename: 'one.txt' };
describe('论文配置、布局与同步', () => {
  it('物理尺寸严格换算为用户要求的像素数量', () => {
    expect(pixelSize(defaultConfig().size)).toEqual({ width: 2100, height: 1320 });
    expect(pixelSize({ unit: 'mm', width: 88.9, height: 55.88, dpi: 600 })).toEqual({ width: 2100, height: 1320 });
    expect(applyTemplate(defaultConfig(), 'double').size.width).toBe(7.16);
  });
  it('切换模板保留范围、轴名称与数据引用', () => {
    const c = defaultConfig(); c.x = { ...c.x, title: '时间', autoRange: false, min: 1.4, max: 1.5 };
    const next = applyTemplate(c, 'double'); expect(next.x).toEqual(c.x);
    expect(buildFigure([file], {}, false, next, 0).traces[0].x).toBe(file.time);
  });
  it('手动范围、间隔、小数和精确刻度数量', () => {
    const c = defaultConfig(); c.x = { ...c.x, autoRange: false, min: 1.4, max: 1.8, ticks: 'interval', interval: .1, decimals: 3 };
    c.y[0] = { ...c.y[0], autoRange: false, min: -10, max: 100, ticks: 'count', count: 3 };
    const figure = buildFigure([file], {}, false, c, 0);
    expect(figure.layout.xaxis?.range).toEqual([1.4, 1.8]); expect(figure.layout.xaxis?.dtick).toBe(.1); expect(figure.layout.xaxis?.tickformat).toBe('.3f');
    expect(figure.layout.yaxis?.tickvals).toEqual([-10, 45, 100]); expect(figure.traces[0].y).toBe(file.signals[0].values);
    expect(Math.max(...figure.traces[0].y)).toBe(99);
  });
  it('三子图路由、共享 X、独立 Y 坐标与线型', () => {
    const c = defaultConfig(); c.panels = 3; c.size.height = 4.5;
    const styles = Object.fromEntries(file.signals.map((s, i) => [curveKey(file.id, i), { ...curveDefaults(s.name, COLORS[i]), panel: i + 1, dash: 'dash' as const, width: 2 }]));
    const f = buildFigure([file], styles, false, c, 0);
    expect(f.traces.map(t => t.yaxis)).toEqual(['y', 'y2', 'y3']); expect(f.traces[1].line.dash).toBe('dash');
    expect(f.layout.xaxis2).toMatchObject({ matches: 'x' }); expect(f.layout.yaxis2).toMatchObject({ range: [-5.45, 4.45] });
    expect(f.traces[0].y).toBe(file.signals[0].values);
  });
  it('默认同步格式保留目标的名称、颜色、范围和所有数据', () => {
    const source = defaultConfig(); source.x = { ...source.x, autoRange: false, min: 10, max: 20 }; source.font.tick = 11;
    const target = defaultConfig(); target.title = '目标标题'; target.x.title = '目标时间'; target.x.min = 1; target.x.max = 2;
    const next = syncConfig(source, target, { colors: false, ranges: false });
    expect(next.font.tick).toBe(11); expect(next.x.min).toBe(1); expect(next.x.autoRange).toBe(true); expect(next.x.title).toBe('目标时间'); expect(next.title).toBe('目标标题');
    expect(syncConfig(source, target, { colors: true, ranges: true }).x.min).toBe(10);
    const other = { ...file, id: 'other', filename: 'other.txt' };
    const styles = { 'one:0': { ...curveDefaults('source', '#ff0000'), width: 3, dash: 'dot' as const }, 'other:0': curveDefaults('target', '#000000') };
    const synced = syncCurveStyles([file], [other], styles, source, { colors: false, ranges: false });
    expect(synced['other:0']).toMatchObject({ name: 'target', color: '#000000', width: 3, dash: 'dot' }); expect(other.time).toBe(file.time);
    expect(syncCurveStyles([file], [other], styles, source, { colors: true, ranges: true })['other:0'].color).toBe('#ff0000');
  });
  it('拒绝倒置范围、过密刻度与过大的图片', () => {
    const c = defaultConfig(); c.x.autoRange = false; c.x.min = 2; c.x.max = 1; expect(validateConfig(c).join()).toContain('最小值');
    c.x = { ...c.x, min: 1, max: 2, ticks: 'interval', interval: 1e-6 }; expect(() => buildFigure([file], {}, false, c, 0)).toThrow('1000');
    c.size.dpi = 9999; expect(validateConfig(c).join()).toContain('DPI');
  });
  it('导出文件名避免大小写与重复冲突', () => expect(uniqueNames(['a.txt', 'a.csv', 'A.txt', 'x:y.txt'], 'svg')).toEqual(['a.svg', 'a-2.svg', 'A-3.svg', 'x_y.svg']));
  it('PNG DPI 元数据使用米制像素密度并避免重复 pHYs', () => {
    const png = new Uint8Array(45); png.set(new TextEncoder().encode('IEND'), 37);
    const result = withDpi(png, 600); expect(new TextDecoder().decode(result.subarray(37, 41))).toBe('pHYs'); expect(new DataView(result.buffer).getUint32(41)).toBe(23622);
    expect(withDpi(result, 300).length).toBe(result.length);
  });
});
