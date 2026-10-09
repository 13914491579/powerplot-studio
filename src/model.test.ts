import { describe, expect, it } from 'vitest';
import { COLORS, curveKey, tracesFor } from './model';
import { parseText, type Dataset } from './parser';

const first: Dataset = { ...parseText('Time/s,A,B,C,D\n1.4,1,2,3,4\n1.401,5,6,7,8'), id: 'first', filename: 'first.txt' };
const second: Dataset = { ...parseText('Time/s,I\n2,10\n2.02,20\n2.35,30'), id: 'second', filename: 'second.csv' };
describe('曲线与文件映射', () => {
  it('使用指定的红、黄、蓝默认颜色', () => {
    expect(COLORS.slice(0, 3)).toEqual(['#E53935', '#D4A000', '#2563EB']);
    expect(tracesFor([first], {}, false).map(t => t.line.color)).toEqual(COLORS.slice(0, 4));
  });
  it('合并模式保留各自不同长度、不同采样间隔的原始数组', () => {
    const traces = tracesFor([first, second], {}, true);
    expect(traces).toHaveLength(5);
    expect(traces[0].x).toBe(first.time);
    expect(traces[4].x).toBe(second.time);
    expect(traces[4].y).toBe(second.signals[0].values);
    expect(traces[0].name).toBe('first.txt · A');
    expect(traces[4].name).toBe('second.csv · I');
  });
  it('分别模式使用信号名称，单文件内多列仍属于同一图', () => {
    expect(tracesFor([first], {}, false).map(t => t.name)).toEqual(['A', 'B', 'C', 'D']);
  });
  it('颜色、名称、显示状态修改不会改变原始数据', () => {
    const trace = tracesFor([first], { [curveKey(first.id, 0)]: { name: '直流电流', color: '#000000', visible: false } }, false)[0];
    expect(trace.name).toBe('直流电流');
    expect(trace.line.color).toBe('#000000');
    expect(trace.visible).toBe('legendonly');
    expect(first.signals[0].name).toBe('A');
    expect(trace.line.simplify).toBe(false);
  });
});
