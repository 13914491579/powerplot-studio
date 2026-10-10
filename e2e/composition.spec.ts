import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import JSZip from 'jszip';
const samples = ['A','B','C'].map((name,i)=>({name:name+'.txt',mimeType:'text/plain',buffer:Buffer.from(`Time/s,P/pu,Udc/pu,Idc/pu\n${1+i},1,2,3\n${1+i+[.001,.02,.5][i]},999,4,5\n${1.8+i},6,7,8`)}));
async function tab(page:Page,name:string){await page.getByRole('navigation',{name:'绘图编辑分类'}).getByRole('button',{name,exact:true}).click();}
async function ready(page:Page){await expect(page.locator('.chart-actions button').first()).toBeEnabled();}
async function load(page:Page,duplicate=false){await page.goto('/');await page.locator('input[type=file]').setInputFiles(duplicate?samples.map(s=>({...s,name:'same.txt'})):samples);await ready(page);await page.getByRole('button',{name:'组合绘图',exact:true}).click();await tab(page,'子图');await page.getByRole('button',{name:'1×3 布局',exact:true}).click();await ready(page);}
async function assign(page:Page,mode:string){await page.getByRole('button',{name:`按${mode}自动分配`,exact:true}).click();await page.getByRole('button',{name:'确认应用分配',exact:true}).click();await ready(page);}
async function figure(page:Page){return page.locator('.plot-area').first().evaluate(el=>{const gd=el as unknown as {data:any[],layout:any};return {data:gd.data.filter(t=>!t.meta?.emptyPanel).map(t=>({x:t.x,y:t.y,name:t.name,xaxis:t.xaxis,yaxis:t.yaxis,meta:t.meta,visible:t.visible,line:t.line,showlegend:t.showlegend})),layout:gd.layout};});}
async function inside(page:Page){const clipped=await page.locator('.plot-area').first().evaluate(el=>{const b=el.getBoundingClientRect();return Array.from(el.querySelectorAll('svg text')).filter(t=>/^(x\d*title|y\d*title|annotation-text|legendtext)$/.test(t.getAttribute('class')??'')).filter(t=>{const r=t.getBoundingClientRect();return r.width&&(r.left<b.left-2||r.right>b.right+2||r.top<b.top-2||r.bottom>b.bottom+2);}).map(t=>t.textContent);});expect(clipped).toEqual([]);const overlap=await page.locator('.plot-area').first().evaluate(el=>{const boxes=Array.from(el.querySelectorAll('svg g[class^="legend"]')).filter(e=>/^legend\d*$/.test(e.getAttribute('class')??'')).map(e=>e.getBoundingClientRect()).filter(b=>b.width&&b.height);return boxes.some((a,i)=>boxes.some((b,j)=>j>i&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));});expect(overlap).toBe(false);}

test('跨文件按文件/信号分配，原始采样与尖峰、复制和独立实例样式',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await load(page);await assign(page,'文件');let f=await figure(page);
  expect(f.data.map(t=>t.yaxis)).toEqual(['y','y','y','y2','y2','y2','y3','y3','y3']);
  const original=f.data.map(t=>({source:t.meta.sourceId,x:t.x,y:t.y}));expect(f.data[3].x).toEqual([2,2.02,2.8]);expect(f.data[0].y).toContain(999);
  await assign(page,'信号');f=await figure(page);expect(f.data.map(t=>t.yaxis)).toEqual(['y','y2','y3','y','y2','y3','y','y2','y3']);
  expect(f.data.map(t=>({source:t.meta.sourceId,x:t.x,y:t.y}))).toEqual(original);
  await page.getByLabel('当前编辑子图').selectOption('1');await page.getByLabel('文件 1 · P/pu · 列 2',{exact:true}).check();await ready(page);expect((await figure(page)).data).toHaveLength(10);
  await tab(page,'曲线');await page.locator('.curve-group').first().getByLabel('P/pu 曲线名称',{exact:true}).fill('Copy');await page.locator('.curve-group').first().getByLabel('P/pu 颜色',{exact:true}).fill('#000000');await ready(page);
  f=await figure(page);const copies=f.data.filter(t=>t.meta.sourceId===f.data[0].meta.sourceId);expect(copies).toHaveLength(2);expect(copies[0].name).toContain('P/pu');expect(copies[1].name).toContain('Copy');expect(copies[1].line.color).toBe('#000000');expect(copies[0].x).toEqual(copies[1].x);
  await tab(page,'子图');await page.getByRole('button',{name:'1×1 布局'}).click();await ready(page);await expect(page.getByRole('status').filter({hasText:'超出当前布局'})).toBeVisible();await page.getByRole('button',{name:'1×3 布局'}).click();await ready(page);expect((await figure(page)).data).toHaveLength(10);expect(errors).toEqual([]);
});

test('同名文件、全选清空、删除引用、三种模式的布局和样式隔离',async({page})=>{
  await load(page,true);await assign(page,'文件');let f=await figure(page);expect(f.data[0].name).toContain('[1]');expect(f.data[3].name).toContain('[2]');expect(f.data[0].meta.sourceId).not.toBe(f.data[3].meta.sourceId);
  await page.getByRole('button',{name:'合并绘图',exact:true}).click();await tab(page,'模板');await page.getByLabel('尺寸模板').selectOption('double');await ready(page);f=await figure(page);expect(f.data).toHaveLength(9);expect(f.data.every(t=>t.yaxis==='y')).toBe(true);expect(f.layout.width).toBeCloseTo(7.16*96);
  await page.getByRole('button',{name:'分别绘图',exact:true}).click();await expect(page.locator('.chart-card')).toHaveCount(3);await ready(page);expect((await figure(page)).layout.width).toBe(336);
  await page.getByRole('button',{name:'组合绘图',exact:true}).click();await ready(page);expect((await figure(page)).layout.width).toBeCloseTo(7.16*96);await tab(page,'子图');
  await page.getByLabel('当前编辑子图').selectOption('0');await page.getByRole('button',{name:'清空当前子图分配'}).click();await ready(page);expect((await figure(page)).data).toHaveLength(6);
  await page.locator('.source-file').first().getByRole('button',{name:'全选此文件信号'}).click();await ready(page);expect((await figure(page)).data).toHaveLength(9);
  const before=(await figure(page)).data.filter(t=>t.yaxis==='y3');await page.getByRole('button',{name:'移除 same.txt',exact:true}).nth(1).click();await ready(page);f=await figure(page);expect(f.data).toHaveLength(6);expect(f.data.filter(t=>t.yaxis==='y3').map(t=>[t.x,t.y,t.meta.sourceId])).toEqual(before.map(t=>[t.x,t.y,t.meta.sourceId]));
});

test('分配容量与重名/无表头候选有预览，不静默丢弃',async({page})=>{
  await load(page);await page.getByRole('button',{name:'1×2 布局'}).click();await page.getByRole('button',{name:'按文件自动分配'}).click();await expect(page.getByRole('button',{name:'确认应用分配'})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('超过');
  await page.getByLabel('仅分配前 2 组').check();await page.getByRole('button',{name:'确认应用分配'}).click();await ready(page);expect((await figure(page)).data).toHaveLength(6);
  await page.locator('input[type=file]').setInputFiles([{name:'missing.txt',mimeType:'text/plain',buffer:Buffer.from('1,2\n2,4')},{name:'duplicate.csv',mimeType:'text/csv',buffer:Buffer.from('t,P/pu,P/pu\n1,2,3\n2,4,5')}]);await ready(page);await page.getByRole('button',{name:'按信号自动分配'}).click();await expect(page.getByRole('region',{name:'自动分配预览'})).toContainText('无表头');await expect(page.getByRole('region',{name:'自动分配预览'})).toContainText('重名表头');
});

for(const shape of ['1×3','3×1','2×2']) test(shape+' 跨文件组合 PNG/SVG/矢量 PDF 与 ZIP',async({page})=>{
  await load(page);await page.getByRole('button',{name:shape+' 布局',exact:true}).click();await assign(page,'文件');await tab(page,'图例');await page.getByLabel('图例作用域').selectOption('panel');await ready(page);await inside(page);
  const f=await figure(page);expect(f.data).toHaveLength(9);const base='.qa/composition-'+shape.replace('×','x');await page.locator('.plot-area').screenshot({path:base+'-preview.png'});
  for(const format of ['SVG','PNG','PDF']){const download=page.waitForEvent('download');await page.getByRole('button',{name:'↓ '+format,exact:true}).click();await(await download).saveAs(base+'.'+format.toLowerCase());}
  const svg=readFileSync(base+'.svg','utf8');expect(svg).not.toContain('<image');expect(svg).not.toContain('modebar');for(const name of ['A.txt','B.txt','C.txt','P/pu','Udc/pu','Idc/pu','(a)','(b)','(c)'])expect(svg).toContain(name);
  expect((svg.match(/class="js-line"/g)??[]).length).toBeGreaterThanOrEqual(9);expect((svg.match(/class="x\d*title"/g)??[]).length).toBe(shape==='3×1'?1:shape==='2×2'?4:3);
  const png=readFileSync(base+'.png');expect(png.readUInt32BE(16)).toBe(Math.round(f.layout.width/96*600));expect(png.readUInt32BE(20)).toBe(Math.round(f.layout.height/96*600));
  const pdf=readFileSync(base+'.pdf'),content=pdf.toString('latin1');expect(content).not.toContain('/Subtype /Image');const media=content.match(/\/MediaBox\s*\[([^\]]+)\]/)![1].trim().split(/\s+/).map(Number);expect(media[2]).toBeCloseTo(f.layout.width*.75);expect(media[3]).toBeCloseTo(f.layout.height*.75);
  let vector=false;for(const m of content.matchAll(/stream\r?\n/g)){const start=m.index!+m[0].length,end=content.indexOf('endstream',start);try{if(/\s[mlc]\s/.test(inflateSync(pdf.subarray(start,end)).toString('latin1')))vector=true;}catch{}}expect(vector).toBe(true);
  await tab(page,'导出');await page.getByLabel('导出格式').selectOption('svg');const zipEvent=page.waitForEvent('download');await page.getByRole('button',{name:'全部图表打包 ZIP'}).click();const zip=await zipEvent;await zip.saveAs(base+'.zip');const unpack=await JSZip.loadAsync(readFileSync(base+'.zip'));expect(Object.keys(unpack.files)).toHaveLength(1);expect(await Object.values(unpack.files)[0].async('string')).toContain('C.txt');
});
