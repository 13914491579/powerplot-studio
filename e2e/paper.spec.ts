import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import JSZip from 'jszip';
import path from 'node:path';

async function load(page: Page, names = ['public/examples/multi-signal.csv']) {
  await page.goto('/'); await page.locator('input[type=file]').setInputFiles(names.map(n => path.resolve(n)));
  await expect(page.locator('.chart-actions button').first()).toBeEnabled();
}
async function tab(page: Page, name: string) { await page.getByRole('navigation', { name: '绘图编辑分类' }).getByRole('button', { name, exact: true }).click(); }
async function ready(page: Page) { await expect(page.locator('.chart-actions button').first()).toBeEnabled(); }
async function figure(page: Page, index = 0) { return page.locator('.plot-area').nth(index).evaluate(element => {
  const gd = element as unknown as { data: { x: number[]; y: number[]; name: string; line: { width: number; color: string; dash: string }; yaxis: string }[]; layout: Record<string, unknown> };
  return { data: gd.data.map(t => ({ x: t.x, y: t.y, name: t.name, line: t.line, yaxis: t.yaxis })), layout: gd.layout };
}); }

test('IEEE 单双栏、手动范围与刻度、曲线样式、双三子图及矢量 PDF', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await load(page);
  const original = (await figure(page)).data;
  await page.getByRole('textbox', { name: 'Idc/pu 曲线名称' }).fill('故障电流');
  await page.getByText('Idc/pu 样式', { exact: true }).click();
  await page.getByLabel('Idc/pu 线宽 / pt', { exact: true }).fill('2');
  await page.getByLabel('Idc/pu 线型', { exact: true }).selectOption('dashdot');
  await ready(page); expect((await figure(page)).data[0].line).toMatchObject({ width: 2 * 96 / 72, dash: 'dashdot' });
  await tab(page, '坐标轴');
  await page.getByLabel('X 自动范围', { exact: true }).uncheck();
  await page.getByLabel('X 最小值', { exact: true }).fill('1.95'); await page.getByLabel('X 最大值', { exact: true }).fill('2.08');
  await page.getByLabel('X 刻度方式', { exact: true }).selectOption('interval'); await page.getByLabel('X 主刻度间隔', { exact: true }).fill('.02');
  await page.getByLabel('X 小数位数', { exact: true }).selectOption('3');
  await page.getByLabel('编辑坐标轴').selectOption('0'); await page.getByLabel('Y1 自动范围', { exact: true }).uncheck();
  await page.getByLabel('Y1 最小值', { exact: true }).fill('0'); await page.getByLabel('Y1 最大值', { exact: true }).fill('1.3');
  await page.getByLabel('Y1 刻度方式', { exact: true }).selectOption('count'); await page.getByLabel('Y1 刻度数量', { exact: true }).fill('3');
  await ready(page);
  const manual = await figure(page);
  expect(manual.layout.xaxis).toMatchObject({ range: [1.95, 2.08], dtick: .02, tickformat: '.3f' });
  expect(manual.layout.yaxis).toMatchObject({ range: [0, 1.3], tickvals: [0, .65, 1.3] });
  expect(manual.data.map(t => t.x)).toEqual(original.map(t => t.x)); expect(manual.data.map(t => t.y)).toEqual(original.map(t => t.y));

  await tab(page, '模板'); await page.getByLabel('尺寸模板').selectOption('double'); await ready(page);
  expect((await figure(page)).layout.width).toBeCloseTo(7.16 * 96);
  expect((await figure(page)).data[0].name).toBe('故障电流');
  await page.getByLabel('尺寸模板').selectOption('single'); await ready(page);
  await page.getByLabel('尺寸单位').selectOption('mm'); expect(Number(await page.getByLabel('图片宽度', { exact: true }).inputValue())).toBeCloseTo(88.9);
  await page.getByLabel('尺寸单位').selectOption('inch');
  await tab(page, '子图'); await page.getByLabel('子图数量').selectOption('2'); await page.getByRole('button', { name: '顺序分配曲线到子图' }).click(); await ready(page);
  expect((await figure(page)).data.map(t => t.yaxis)).toEqual(['y', 'y2', 'y']);
  await page.getByLabel('子图数量').selectOption('3'); await page.getByRole('button', { name: '顺序分配曲线到子图' }).click(); await ready(page);
  const panels = await figure(page); expect(panels.data.map(t => t.yaxis)).toEqual(['y', 'y2', 'y3']); expect(panels.layout.xaxis2).toMatchObject({ matches: 'x' });
  expect(panels.data.map(t => t.y)).toEqual(original.map(t => t.y));
  await page.getByRole('textbox', { name: 'X 轴标题', exact: true }).fill('时间 / s');
  await tab(page, '字体与排版'); await page.getByLabel('图表标题', { exact: true }).fill('故障暂态波形');
  await ready(page); await page.screenshot({ path: '.qa/paper-subplots.png', fullPage: true });

  const pdfEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '↓ PDF', exact: true }).click(); const download = await pdfEvent; await download.saveAs('.qa/paper.pdf');
  const pdf = readFileSync('.qa/paper.pdf'); const content = pdf.toString('latin1');
  expect(content.startsWith('%PDF-')).toBe(true); expect(content).not.toContain('/Subtype /Image'); expect(content).toContain('/FontFile2');
  const mediaBox = content.match(/\/MediaBox\s*\[([^\]]+)\]/)![1].trim().split(/\s+/).map(Number);
  expect(mediaBox[2]).toBeCloseTo(252); expect(mediaBox[3]).toBeCloseTo(324);
  const streams: string[] = [];
  for (const match of content.matchAll(/stream\r?\n/g)) {
    const start = match.index! + match[0].length, end = content.indexOf('endstream', start);
    try { streams.push(inflateSync(pdf.subarray(start, end)).toString('latin1')); } catch { /* Non-Flate font tables may be binary. */ }
  }
  expect(streams.some(s => /\s[mlc]\s/.test(s))).toBe(true);
  expect(streams.some(s => /65f6/i.test(s))).toBe(true); // Unicode mapping for 时.
  expect(errors).toEqual([]);
});

test('逐图配置与格式同步保护名称颜色范围，可选范围颜色同步及多图 ZIP', async ({ page }) => {
  await load(page, ['public/examples/pscad-real.txt', 'public/examples/multi-signal.csv']);
  await tab(page, '模板'); await page.getByLabel('尺寸模板').selectOption('double');
  await tab(page, '字体与排版'); await page.getByLabel('刻度字号 / pt', { exact: true }).fill('10');
  await tab(page, '坐标轴'); await page.getByLabel('X 自动范围', { exact: true }).uncheck(); await page.getByLabel('X 最小值', { exact: true }).fill('1.98'); await page.getByLabel('X 最大值', { exact: true }).fill('2.1'); await ready(page);
  await page.getByLabel('当前图表').selectOption({ label: 'multi-signal.csv' });
  await tab(page, '曲线'); await page.getByRole('textbox', { name: 'Idc/pu 曲线名称' }).fill('目标电流'); await page.getByLabel('Idc/pu 颜色', { exact: true }).fill('#aa00bb');
  await tab(page, '坐标轴'); await page.getByLabel('X 自动范围', { exact: true }).uncheck(); await page.getByLabel('X 最小值', { exact: true }).fill('1.95'); await page.getByLabel('X 最大值', { exact: true }).fill('2.08');
  await page.getByLabel('当前图表').selectOption({ label: 'pscad-real.txt' }); await page.getByRole('button', { name: '应用格式到其他图表' }).click();
  await expect.poll(async () => (await figure(page, 1)).layout.width).toBeCloseTo(7.16 * 96);
  const target = await figure(page, 1); expect(target.data[0]).toMatchObject({ name: '目标电流', line: { color: '#aa00bb' } }); expect(target.layout.xaxis).toMatchObject({ range: [1.95, 2.08], tickfont: { size: 10 * 96 / 72 } });
  await page.getByLabel('同时同步颜色', { exact: true }).check(); await page.getByLabel('同时同步坐标范围', { exact: true }).check(); await page.getByRole('button', { name: '应用格式到其他图表' }).click();
  await expect.poll(async () => (await figure(page, 1)).data[0].line.color).toBe('#E53935'); expect((await figure(page, 1)).layout.xaxis).toMatchObject({ range: [1.98, 2.1] });
  expect(Math.max(...(await figure(page)).data[0].y)).toBeGreaterThan(6); // Real fault spike survives style sync.
  await tab(page, '导出'); await page.getByLabel('导出格式').selectOption('svg');
  const zipEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '全部图表打包 ZIP' }).click(); const download = await zipEvent; await download.saveAs('.qa/all-svg.zip');
  const zip = await JSZip.loadAsync(readFileSync('.qa/all-svg.zip')); expect(Object.keys(zip.files)).toEqual(['pscad-real.svg', 'multi-signal.svg']);
  expect(await zip.file('multi-signal.svg')!.async('string')).toContain('目标电流');
});

test('批量重名安全与自定义 DPI PNG', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles([{ name: 'wave.txt', mimeType: 'text/plain', buffer: Buffer.from('t,A\n4,0\n4.0001,100\n4.1,1') }, { name: 'wave.csv', mimeType: 'text/csv', buffer: Buffer.from('t,B\n4,2\n4.2,3') }]); await ready(page);
  await tab(page, '导出'); await page.getByLabel('DPI', { exact: true }).fill('300'); await ready(page);
  const pngEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '导出当前图表', exact: true }).click(); await (await pngEvent).saveAs('.qa/paper-300.png');
  const png = readFileSync('.qa/paper-300.png'); expect(png.readUInt32BE(16)).toBe(1050); expect(png.readUInt32BE(20)).toBe(660); const density = png.indexOf('pHYs'); expect(png.readUInt32BE(density + 4)).toBe(11811);
  await page.getByLabel('导出格式').selectOption('pdf');
  const zipEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '全部图表打包 ZIP' }).click(); await (await zipEvent).saveAs('.qa/all-pdf.zip');
  const zip = await JSZip.loadAsync(readFileSync('.qa/all-pdf.zip')); expect(Object.keys(zip.files)).toEqual(['wave.pdf', 'wave-2.pdf']);
  expect((await zip.file('wave.pdf')!.async('string')).startsWith('%PDF')).toBe(true);
  await page.getByLabel('导出格式').selectOption('png');
  const pngZipEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '全部图表打包 ZIP' }).click(); await (await pngZipEvent).saveAs('.qa/all-png.zip');
  const pngZip = await JSZip.loadAsync(readFileSync('.qa/all-png.zip')); expect(Object.keys(pngZip.files)).toEqual(['wave.png', 'wave-2.png']);
  expect((await pngZip.file('wave.png')!.async('nodebuffer')).readUInt32BE(16)).toBe(1050);
});

test('外置图例、边框透明度与标签均在画布内', async ({ page }) => {
  await load(page); await tab(page, '模板'); await page.getByLabel('尺寸模板').selectOption('double');
  await page.getByRole('textbox', { name: 'X 轴标题', exact: true }).fill('时间 / s');
  await page.getByRole('textbox', { name: 'Y 轴标题', exact: true }).fill('电流与电压 / pu');
  await tab(page, '图例'); await page.getByLabel('图例边框').check(); await page.getByLabel('图例背景不透明度', { exact: true }).fill('.5');
  for (const position of ['top', 'bottom', 'left', 'right', 'inside', 'manual']) {
    await page.getByLabel('图例位置').selectOption(position); await page.getByLabel('图例排列').selectOption(position === 'left' || position === 'right' ? 'v' : 'h'); await ready(page);
    const overflow = await page.locator('.plot-area').evaluate(element => {
      const box = element.getBoundingClientRect();
      return Array.from(element.querySelectorAll('.legend text, .xtitle, .ytitle')).filter(e => {
        const b = e.getBoundingClientRect(); return b.width && (b.left < box.left - 2 || b.right > box.right + 2 || b.top < box.top - 2 || b.bottom > box.bottom + 2);
      }).map(e => e.textContent);
    });
    expect(overflow, position).toEqual([]);
  }
});

test('Noto 字体随 SVG 携带，PDF 缺字明确提示', async ({ page }) => {
  await load(page); await tab(page, '字体与排版');
  await page.getByLabel('全局字体').selectOption('Noto Sans SC'); await page.getByLabel('图表标题', { exact: true }).fill('暂态 Ω μ'); await ready(page);
  const svgEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '↓ SVG', exact: true }).click(); await (await svgEvent).saveAs('.qa/noto.svg');
  const svg = readFileSync('.qa/noto.svg', 'utf8'); expect(svg).toContain('data:font/ttf;base64,'); expect(svg).toContain('width="3.5in"');
  const pngEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '↓ PNG', exact: true }).click(); await (await pngEvent).saveAs('.qa/noto.png');
  await page.getByLabel('图表标题', { exact: true }).fill('不支持的 🚀'); await ready(page);
  await page.getByRole('button', { name: '↓ PDF', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('不支持字符');
});
