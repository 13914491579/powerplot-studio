import { describe, it, expect } from 'vitest';
import { GRID_LAYOUTS, changeLayout, defaultConfig, restoreRecommendedSize, applyTemplate, pixelSize, xFor, updateX, syncConfig, curveDefaults } from './config';
import { buildFigure } from './layout';
import { parseText } from './parser';
import { curveKey, COLORS } from './model';

const file = { ...parseText('Time/s,A,B,C,D\n1.399,0,2,3,4\n1.400001,999,-5,7,9\n1.9,1,4,6,8'), id: 'grid', filename: 'grid.txt' };
const styles = Object.fromEntries(file.signals.map((s, i) => [curveKey(file.id, i), { ...curveDefaults(s.name, COLORS[i]), panel: i + 1 }]));
const axis = (figure: ReturnType<typeof buildFigure>, kind: string, i: number) => figure.layout[kind + 'axis' + (i ? i + 1 : '')] as { domain: number[]; title: { text: string }; showticklabels: boolean; matches?: string; range: number[] };

describe('二维网格布局与科研数据准确性', () => {
  it.each(GRID_LAYOUTS)('%i×%i 推荐尺寸、独立域、行优先编号及原始数组', (rows, columns) => {
    const c = changeLayout(defaultConfig(), rows, columns), f = buildFigure([file], styles, false, c, 0);
    expect(c.size.width).toBe(columns === 1 ? 3.5 : 7.16);
    expect(f.traces).toHaveLength(rows * columns);
    for (let i = 0; i < c.panels; i++) {
      const x = axis(f, 'x', i), y = axis(f, 'y', i);
      expect(x.domain[1]).toBeGreaterThan(x.domain[0]); expect(y.domain[1]).toBeGreaterThan(y.domain[0]);
      expect(x.showticklabels).toBe(columns > 1 || i === c.panels - 1);
      expect(Boolean(x.title.text)).toBe(x.showticklabels);
      expect(f.traces[i].x).toBe(file.time); expect(f.traces[i].y).toBe(file.signals[i].values);
    }
    if (c.panels > 1) expect(f.layout.annotations?.map(a => a.text)).toEqual(Array.from({ length: c.panels }, (_, i) => `(${String.fromCharCode(97+i)})`));
    if (columns > 1) expect(axis(f,'x',1).domain[0]).toBeGreaterThan(axis(f,'x',0).domain[1]);
    if (rows > 1) expect(axis(f,'y',columns).domain[1]).toBeLessThan(axis(f,'y',0).domain[0]);
    expect(Math.max(...f.traces[0].y)).toBe(999);
  });
  it('范围同步与标题/刻度显隐完全分离，按列交互匹配', () => {
    let c = changeLayout(defaultConfig(),2,2);
    c = updateX(c,0,{ autoRange:false,min:1,max:2,title:'First',unit:'s' });
    c = updateX(c,1,{ autoRange:false,min:3,max:4,title:'Second' });
    c.sharedX=true; c.xSync='column';
    let f = buildFigure([file],styles,false,c,0);
    expect(axis(f,'x',2)).toMatchObject({range:[1,2],matches:'x',showticklabels:true});
    expect(axis(f,'x',3)).toMatchObject({range:[3,4],matches:'x2',showticklabels:true});
    c.xSync='all'; f=buildFigure([file],styles,false,c,0);
    expect(axis(f,'x',1)).toMatchObject({range:[1,2],title:{text:'Second'},showticklabels:true});
    c.hideRepeatedX=true; f=buildFigure([file],styles,false,c,0);
    expect(axis(f,'x',0).showticklabels).toBe(false); expect(axis(f,'x',2).showticklabels).toBe(true);
    c.sharedX=false; f=buildFigure([file],styles,false,c,0);
    expect(axis(f,'x',0).showticklabels).toBe(true); expect(axis(f,'x',1).range).toEqual([3,4]);
  });
  it('手动尺寸、模板尺寸、单位换算在布局切换中不被覆盖，恢复推荐可重新启用', () => {
    let c=applyTemplate(defaultConfig(),'single');
    expect(changeLayout(c,1,4).size).toEqual(c.size);
    c={...c, sizePolicy:'manual',size:{unit:'mm',width:254,height:152.4,dpi:300}};
    const next=changeLayout(c,2,2); expect(next.size).toEqual(c.size); expect(pixelSize(next.size)).toEqual({width:3000,height:1800});
    const restored=restoreRecommendedSize(next); expect(restored.size.width).toBeCloseTo(7.16*25.4); expect(restored.sizePolicy).toBe('recommended');
    expect(changeLayout(restored,4,1).size.height).toBeGreaterThan(changeLayout(restored,3,1).size.height);
  });
  it('隐藏的子图配置/曲线分配保留，多曲线同图，独立图例与编号', () => {
    let c=changeLayout(defaultConfig(),1,4); c.xPanels[2].title='Preserved'; c.y[3].title='Current'; c.panelOptions[3].label='(iv)'; c.legendMode='panel'; c.panelOptions[3].legend.show=false;
    const reduced=changeLayout(c,1,1); expect(buildFigure([file],styles,false,reduced,0).traces).toHaveLength(1);
    c=changeLayout(reduced,2,2); const f=buildFigure([file],styles,false,c,0);
    expect(xFor(c,3).title).toBe('Preserved'); expect(f.layout.annotations?.[3].text).toBe('(iv)'); expect(f.traces[3].showlegend).toBe(false); expect(f.traces[2].legend).toBe('legend3');
    const overlay={...styles,'grid:1':{...styles['grid:1'],panel:1}};
    expect(buildFigure([file],overlay,false,c,0).traces.map(t=>t.yaxis)).toEqual(['y','y','y3','y4']);
    expect(styles['grid:3'].panel).toBe(4);
  });
  it('过窄尺寸明确拒绝，不改写配置/数据；同步保护每张子图范围与单位', () => {
    const source=changeLayout(defaultConfig(),1,4); source.size.width=3.5;
    expect(()=>buildFigure([file],styles,false,source,0)).toThrow('扩大画布'); expect(source.size.width).toBe(3.5);
    const target=defaultConfig(); target.xPanels[2]={...target.xPanels[2],min:10,max:20,title:'Keep',unit:'ms'};
    expect(syncConfig(source,target,{colors:false,ranges:false}).xPanels[2]).toMatchObject({min:10,max:20,title:'Keep',unit:'ms'});
  });
});
