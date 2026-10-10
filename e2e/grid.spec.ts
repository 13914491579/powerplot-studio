import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

async function tab(page: Page, name: string) { await page.getByRole('navigation', { name:'绘图编辑分类' }).getByRole('button',{ name, exact:true }).click(); }
async function ready(page: Page) { await expect(page.locator('.chart-actions button').first()).toBeEnabled(); }
async function load(page: Page) {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'grid.csv',mimeType:'text/csv',buffer:Buffer.from('Time/s,A/pu,B/pu,C/pu,D/pu\n1.399,0,2,3,4\n1.400001,999,-5,7,9\n1.9,1,4,6,8')}); await ready(page);
  await tab(page,'子图');
}
async function layout(page: Page, shape: string) { await page.getByRole('button',{name:shape+' 布局',exact:true}).click(); await ready(page); }
async function figure(page: Page) { return page.locator('.plot-area').first().evaluate(element => {
  const gd = element as unknown as { layout:Record<string,any>; data:any[] };
  return { layout:gd.layout, data:gd.data.filter(t => !t.meta?.emptyPanel).map(t => ({ x:t.x,y:t.y,xaxis:t.xaxis,yaxis:t.yaxis,name:t.name,legend:t.legend,showlegend:t.showlegend })) };
}); }
async function labelsInside(page: Page) {
  const overflow=await page.locator('.plot-area').first().evaluate(element=>{
    const box=element.getBoundingClientRect();
    return Array.from(element.querySelectorAll('svg text')).filter(e=> /^(x\d*title|y\d*title|annotation-text|legendtext)$/.test(e.getAttribute('class')??'')).filter(e=>{const b=e.getBoundingClientRect(); return b.width && (b.left < box.left-2 || b.right > box.right+2 || b.top < box.top-2 || b.bottom > box.bottom+2);}).map(e=>e.textContent);
  }); expect(overflow).toEqual([]);
}

test('八种布局实际渲染、各轴标题与编号完整、推荐尺寸与数据保持',async({page})=>{
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message)); await load(page);
  const original=(await figure(page)).data;
  for(const [rows,cols] of [[1,1],[1,2],[2,1],[1,3],[3,1],[2,2],[1,4],[4,1]]) {
    await layout(page,rows+'×'+cols); await page.getByRole('button',{name:'顺序分配曲线到子图'}).click(); await ready(page);
    const f=await figure(page); expect(f.layout.width).toBeCloseTo((cols===1?3.5:7.16)*96);
    expect(f.data.map(t=>t.x)).toEqual(original.map(t=>t.x)); expect(f.data.map(t=>t.y)).toEqual(original.map(t=>t.y));
    for(let i=0;i<rows*cols;i++) {
      const suffix=i?i+1:''; const x=f.layout['xaxis'+suffix]; expect(x.showticklabels).toBe(cols>1 || i===rows*cols-1); expect(Boolean(x.title.text)).toBe(x.showticklabels);
      if(x.showticklabels) await expect(page.locator('.plot-area text[class^="x"][class$="title"]').filter({hasText:'Time/s'})).toHaveCount(cols>1?rows*cols:1);
    }
    if(rows*cols>1) expect(f.layout.annotations.map((a:any)=>a.text)).toEqual(Array.from({length:rows*cols},(_,i)=>'('+String.fromCharCode(97+i)+')'));
    await labelsInside(page);
    await page.locator('.plot-area').first().screenshot({path:'.qa/grid-'+rows+'x'+cols+'.png'});
  }
  expect(errors).toEqual([]);
});

test('独立范围、单位、刻度、列同步与标签显隐互不混淆',async({page})=>{
  await load(page); await layout(page,'2×2'); await page.getByRole('button',{name:'顺序分配曲线到子图'}).click();
  await page.getByLabel('当前编辑子图').selectOption('1'); await tab(page,'坐标轴'); await page.getByLabel('编辑坐标轴').selectOption('-1');
  await page.getByLabel('X 轴详细标题',{exact:true}).fill('Local time'); await page.getByLabel('X 轴单位',{exact:true}).fill('ms');
  await page.getByLabel('X 自动范围',{exact:true}).uncheck(); await page.getByLabel('X 最小值',{exact:true}).fill('1.4'); await page.getByLabel('X 最大值',{exact:true}).fill('1.8');
  await page.getByLabel('X 刻度方式',{exact:true}).selectOption('count'); await page.getByLabel('X 刻度数量',{exact:true}).fill('3'); await ready(page);
  expect((await figure(page)).layout.xaxis2).toMatchObject({range:[1.4,1.8],tickvals:[1.4,1.6,1.8],title:{text:'Local time / ms'}});
  await tab(page,'子图'); await page.getByLabel('X 轴范围同步').selectOption('column'); await ready(page);
  let f=await figure(page); expect(f.layout.xaxis4).toMatchObject({matches:'x2',range:[1.4,1.8],showticklabels:true}); expect(f.layout.xaxis3.matches).toBe('x');
  await page.getByLabel('隐藏非底部 X 标题与刻度').check(); await ready(page); expect((await figure(page)).layout.xaxis2.showticklabels).toBe(false);
  await page.getByLabel('X 轴范围同步').selectOption('all'); await ready(page); expect((await figure(page)).layout.xaxis4.matches).toBe('x');
  await page.getByLabel('X 轴范围同步').selectOption('independent'); await ready(page); expect((await figure(page)).layout.xaxis2.showticklabels).toBe(true);
  await layout(page,'4×1'); await page.getByLabel('X 轴范围同步').selectOption('independent'); await ready(page);
  f=await figure(page); expect([f.layout.xaxis,f.layout.xaxis2,f.layout.xaxis3,f.layout.xaxis4].every(x=>x.showticklabels && x.title.text)).toBe(true); await labelsInside(page);
});

test('缩减恢复保持配置和分配、叠加曲线、独立图例、手动尺寸保护',async({page})=>{
  await load(page); await layout(page,'1×4'); await page.getByRole('button',{name:'顺序分配曲线到子图'}).click();
  await page.getByLabel('当前编辑子图').selectOption('3'); await page.getByLabel('子图编号',{exact:true}).fill('(iv)'); await page.getByLabel('编号 X 位置',{exact:true}).fill('.8');
  await tab(page,'坐标轴'); await page.getByLabel('编辑坐标轴').selectOption('3'); await page.getByLabel('Y4 轴详细标题',{exact:true}).fill('Preserved');
  await tab(page,'图例'); await page.getByLabel('图例作用域').selectOption('panel'); await page.getByLabel('图例可见').uncheck();
  await tab(page,'子图'); await layout(page,'1×1'); await expect(page.getByRole('status').filter({hasText:'超出当前布局'})).toBeVisible(); expect((await figure(page)).data).toHaveLength(1);
  await layout(page,'2×2'); let f=await figure(page); expect(f.data).toHaveLength(4); expect(f.layout.yaxis4.title.text).toBe('Preserved'); expect(f.layout.annotations[3]).toMatchObject({text:'(iv)',x:.8}); expect(f.data[3].showlegend).toBe(false);
  await page.getByLabel('B/pu 分配子图').selectOption('1'); await ready(page); expect((await figure(page)).data.map(t=>t.yaxis)).toEqual(['y','y','y3','y4']);
  await page.getByLabel('当前编辑子图').selectOption('0'); await tab(page,'图例'); await page.getByLabel('图例边框').check(); await ready(page); expect((await figure(page)).layout.legend.borderwidth).toBeGreaterThan(0); await labelsInside(page);
  await tab(page,'模板'); await page.getByLabel('图片宽度',{exact:true}).fill('10'); await page.getByLabel('图片高度',{exact:true}).fill('6');
  await tab(page,'子图'); await layout(page,'1×3'); f=await figure(page); expect(f.layout.width).toBe(960); expect(f.layout.height).toBe(576);
  await page.getByRole('button',{name:'恢复布局推荐尺寸'}).click(); await ready(page); expect((await figure(page)).layout.width).toBeCloseTo(7.16*96);
  await tab(page,'模板'); await page.getByLabel('尺寸模板').selectOption('single'); await tab(page,'子图'); await page.getByRole('button',{name:'1×4 布局'}).click();
  await expect(page.getByRole('alert')).toContainText('扩大画布'); await tab(page,'模板'); expect(Number(await page.getByLabel('图片宽度',{exact:true}).inputValue())).toBe(3.5);
  await page.getByRole('button',{name:'恢复布局推荐尺寸'}).click(); await ready(page);
});

test('空子图仍保留坐标轴与编号，独立图例导出及总开关',async({page})=>{
  await page.goto('/'); await page.locator('input[type=file]').setInputFiles({name:'one.csv',mimeType:'text/csv',buffer:Buffer.from('t,A\n1,2\n1.1,4')}); await ready(page);
  await tab(page,'子图'); await layout(page,'1×3');
  const titles=await page.locator('.plot-area text[class^="x"][class$="title"]').allTextContents(); expect(titles).toHaveLength(3);
  await tab(page,'图例'); await page.getByLabel('图例作用域').selectOption('panel'); await page.getByLabel('图例字号 / pt',{exact:true}).fill('10'); await ready(page);
  expect((await figure(page)).layout.legend.font.size).toBeCloseTo(10*96/72);
  const download=page.waitForEvent('download'); await page.getByRole('button',{name:'↓ SVG',exact:true}).click(); await(await download).saveAs('.qa/independent-legends.svg');
  expect(readFileSync('.qa/independent-legends.svg','utf8')).toContain('(c)'); await labelsInside(page);
  await page.getByLabel('显示图例',{exact:true}).uncheck(); await ready(page); expect((await figure(page)).layout.showlegend).toBe(false);
});

for(const shape of ['1×3','1×4','2×2','4×1']) test(shape+' 组合图 PNG/SVG/PDF 尺寸、编号、矢量路径完整',async({page})=>{
  await load(page); await layout(page,shape); await page.getByRole('button',{name:'顺序分配曲线到子图'}).click(); await ready(page); const f=await figure(page);
  await labelsInside(page); const base='.qa/export-'+shape.replace('×','x');
  for(const format of ['SVG','PNG','PDF']) {
    const event=page.waitForEvent('download'); await page.getByRole('button',{name:'↓ '+format,exact:true}).click(); await(await event).saveAs(base+'.'+format.toLowerCase());
  }
  const svg=readFileSync(base+'.svg','utf8'); expect(svg).not.toContain('<image'); expect(svg).not.toContain('modebar');
  const count=shape==='1×3'?3:4; for(let i=0;i<count;i++) expect(svg).toContain('('+String.fromCharCode(97+i)+')');
  const titleCount=(svg.match(/class="x\d*title"/g)??[]).length; expect(titleCount).toBe(shape==='4×1'?1:count);
  expect(svg).toContain('width="'+f.layout.width/96+'in"');
  const png=readFileSync(base+'.png'); expect(png.readUInt32BE(16)).toBe(Math.round(f.layout.width/96*600)); expect(png.readUInt32BE(20)).toBe(Math.round(f.layout.height/96*600));
  const pdf=readFileSync(base+'.pdf'), content=pdf.toString('latin1'); expect(content).not.toContain('/Subtype /Image');
  const media=content.match(/\/MediaBox\s*\[([^\]]+)\]/)![1].trim().split(/\s+/).map(Number); expect(media[2]).toBeCloseTo(f.layout.width*.75); expect(media[3]).toBeCloseTo(f.layout.height*.75);
  let vector=false; for(const m of content.matchAll(/stream\r?\n/g)) {const start=m.index!+m[0].length,end=content.indexOf('endstream',start); try{if(/\s[mlc]\s/.test(inflateSync(pdf.subarray(start,end)).toString('latin1')))vector=true;}catch{}} expect(vector).toBe(true);
});
