import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseText } from './parser';

describe('原始仿真数据解析', () => {
  it('读取带空格的逗号表头与非零起点', () => {
    const data = parseText('Time/s, Idc/pu\n1.399,0.73515647689\n1.400,0.733760958357\n1.401,0.732487377526');
    expect(data.timeLabel).toBe('Time/s');
    expect(data.time).toEqual([1.399, 1.4, 1.401]);
    expect(data.signals).toEqual([{ name: 'Idc/pu', values: [0.73515647689, 0.733760958357, 0.732487377526] }]);
  });
  it.each([',', '\t', '  '])('识别 %j 分隔符，支持多列与科学计数法', separator => {
    const text = [['Time/s', 'A', 'B', 'C'], ['-1e-3', '2E+2', '-.5', '+3.'], ['.01', '-1.25', '0', '4.123456789']].map(r => r.join(separator)).join('\r\n');
    const data = parseText(text);
    expect(data.time).toEqual([-.001, .01]);
    expect(data.signals.map(s => s.values)).toEqual([[200, -1.25], [-.5, 0], [3, 4.123456789]]);
  });
  it('无表头时保留第一行并命名 Curve 1、Curve 2', () => {
    const data = parseText('4.2\t-5\t6\n4.21\t7\t8');
    expect(data.time).toEqual([4.2, 4.21]);
    expect(data.timeLabel).toBe('Time');
    expect(data.signals.map(s => s.name)).toEqual(['Curve 1', 'Curve 2']);
  });
  it('非等间隔、重复及非顺序时间原样保留，不排序或重建', () => {
    const data = parseText('t y\n5 1\n5.001 2\n5.8 3\n5.8 4\n5.4 5');
    expect(data.time).toEqual([5, 5.001, 5.8, 5.8, 5.4]);
    expect(data.signals[0].values).toEqual([1, 2, 3, 4, 5]);
  });
  it('允许 UTF-8 BOM、空行及不同换行形式', () => {
    expect(parseText('\uFEFFTime/s,A\r\n\r\n1,2\r2,3\n').time).toEqual([1, 2]);
  });
  it('支持单采样点', () => expect(parseText('1,2').time).toEqual([1]));
  it.each(['', ' \n\t '])('拒绝空文件 %j', text => expect(() => parseText(text)).toThrow('文件为空'));
  it('拒绝只有表头的数据', () => expect(() => parseText('Time/s,A')).toThrow('没有数据'));
  it('拒绝单列文件', () => expect(() => parseText('1\n2')).toThrow('至少需要两列'));
  it('列数不一致时报告原始行号', () => expect(() => parseText('t,a,b\n\n1,2,3\n2,3')).toThrow('第 4 行列数不一致'));
  it.each(['NaN', 'Infinity', '1e999', '12abc', '', '0xFF'])('拒绝无效值 %j，不跳过无效行', value => {
    expect(() => parseText(`t,a\n1,2\n2,${value}`)).toThrow('第 3 行第 2 列');
  });
  it('拒绝混合数值和文本的首行', () => expect(() => parseText('1,broken\n2,3')).toThrow('混合表头'));
  it('真实 PSCAD 文件的每一行时间和值均与原始数字相同', () => {
    const text = readFileSync(new URL('../新建 文本文档1.txt', import.meta.url), 'utf8');
    const data = parseText(text);
    const rows = text.trim().split(/\r?\n/).slice(1).map(row => row.split(',').map(Number));
    expect(data.timeLabel).toBe('Time/s');
    expect(data.signals[0].name).toBe('Idc/pu');
    expect(data.time).toEqual(rows.map(r => r[0]));
    expect(data.signals[0].values).toEqual(rows.map(r => r[1]));
    expect(data.time[0]).toBe(1.9495);
    expect(data.time.length).toBeGreaterThan(100);
  });
});
