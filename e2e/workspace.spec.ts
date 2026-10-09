import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

async function load(page: Page, names: string[]) {
  await page.locator('input[type=file]').setInputFiles(names.map(name => path.resolve(name)));
  await expect(page.getByRole('status').first()).toContainText('已导入');
  await expect(page.locator('.chart-actions button').first()).toBeEnabled();
}

test('真实数据、多列、合并模式、格式修改、缩放与 PNG/SVG 导出', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '波形工作区' })).toBeVisible();
  await load(page, ['新建 文本文档1.txt', 'public/examples/multi-signal.csv']);
  await expect(page.locator('.chart-card')).toHaveCount(2);
  const original = readFileSync(path.resolve('新建 文本文档1.txt'), 'utf8').trim().split(/\r?\n/).slice(1).map(row => row.split(',').map(Number));
  const originalPlot = await page.locator('.plot-area').first().evaluate(element => {
    const gd = element as unknown as { data: { x: number[]; y: number[]; line: { color: string } }[]; layout: { xaxis: { range: number[] } } };
    return { x: gd.data[0].x, y: gd.data[0].y, color: gd.data[0].line.color, range: gd.layout.xaxis.range };
  });
  expect(originalPlot.x).toEqual(original.map(row => row[0]));
  expect(originalPlot.y).toEqual(original.map(row => row[1]));
  expect(originalPlot.color).toBe('#E53935');
  expect(originalPlot.range[0]).toBeCloseTo(original[0][0], 8);
  expect(originalPlot.range[1]).toBeCloseTo(original.at(-1)![0], 8);
  await page.screenshot({ path: '.qa/separate.png', fullPage: true });

  await page.getByRole('button', { name: '合并绘图', exact: true }).click();
  await expect(page.locator('.chart-card')).toHaveCount(1);
  await expect(page.locator('.chart-actions button').first()).toBeEnabled();
  const merged = await page.locator('.plot-area').evaluate(element => (element as unknown as { data: { x: number[]; name: string; line: { color: string } }[] }).data.map(trace => ({ x: trace.x, name: trace.name, color: trace.line.color })));
  expect(merged).toHaveLength(4);
  expect(merged[0].x).toEqual(original.map(row => row[0]));
  expect(merged[1].x).toEqual([1.9495, 1.95, 1.952, 1.955, 1.9551, 1.956, 1.96, 1.98, 2, 2.05, 2.1]);
  expect(merged.map(t => t.color)).toEqual(['#E53935', '#E53935', '#D4A000', '#2563EB']);
  expect(merged[0].name).toContain('新建 文本文档1.txt');

  await page.getByRole('textbox', { name: 'Idc/pu 曲线名称', exact: true }).first().fill('直流电流');
  await page.getByRole('textbox', { name: 'X 轴标题', exact: true }).fill('时间 / s');
  await page.getByRole('textbox', { name: 'Y 轴标题', exact: true }).fill('电流 / pu');
  await page.getByLabel('Idc/pu 颜色', { exact: true }).first().fill('#00aa66');
  await page.getByRole('checkbox', { name: '显示 Voltage/pu', exact: true }).uncheck();
  await expect(page.locator('.chart-actions button').first()).toBeEnabled();
  await expect.poll(() => page.locator('.plot-area').evaluate(element => {
    const gd = element as unknown as { data: { name: string; line: { color: string }; visible: unknown }[] };
    return [gd.data[0].name, gd.data[0].line.color, gd.data[2].visible];
  })).toEqual(['新建 文本文档1.txt · 直流电流', '#00aa66', 'legendonly']);
  await page.locator('.plot-area .legendtoggle').nth(2).click();
  await expect(page.getByRole('checkbox', { name: '显示 Voltage/pu', exact: true })).toBeChecked();
  await page.locator('.plot-area .legendtoggle').nth(2).click();
  await expect(page.getByRole('checkbox', { name: '显示 Voltage/pu', exact: true })).not.toBeChecked();

  // Exercise real pointer-based zoom and verify it narrows the original time range.
  const plotBox = await page.locator('.plot-area .nsewdrag').boundingBox();
  expect(plotBox).not.toBeNull();
  if (plotBox) {
    await page.mouse.move(plotBox.x + plotBox.width * .25, plotBox.y + plotBox.height * .25);
    await page.mouse.down();
    await page.mouse.move(plotBox.x + plotBox.width * .65, plotBox.y + plotBox.height * .75, { steps: 10 });
    await page.mouse.up();
  }
  await expect.poll(() => page.locator('.plot-area').evaluate(element => {
    const range = (element as unknown as { layout: { xaxis: { range: number[] } } }).layout.xaxis.range;
    return range[1] - range[0];
  })).toBeLessThan(original.at(-1)![0] - original[0][0]);
  await page.getByRole('button', { name: '复位所有图表视图' }).click();
  await expect(page.locator('.chart-actions button').first()).toBeEnabled();
  await expect.poll(() => page.locator('.plot-area').evaluate(element => {
    const range = (element as unknown as { layout: { xaxis: { range: number[] } } }).layout.xaxis.range;
    return range[1] - range[0];
  })).toBeCloseTo(original.at(-1)![0] - original[0][0], 8);

  const svgEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '↓ SVG', exact: true }).click();
  const svgDownload = await svgEvent;
  await svgDownload.saveAs('.qa/export.svg');
  const svg = readFileSync('.qa/export.svg', 'utf8');
  expect(svg).toContain('<svg');
  expect(svg).toContain('时间 / s');
  expect(svg).toContain('电流 / pu');
  expect(svg).toContain('直流电流');
  expect(svg).not.toContain('<image');
  expect(svg).not.toContain('导入数据');
  const pngEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '↓ PNG', exact: true }).click();
  const pngDownload = await pngEvent;
  await pngDownload.saveAs('.qa/export.png');
  const png = readFileSync('.qa/export.png');
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  // Stage 2 default is physically defined: 3.5 × 2.2 inch at 600 DPI.
  expect(png.readUInt32BE(16)).toBe(2100);
  expect(png.readUInt32BE(20)).toBe(1320);
  await page.screenshot({ path: '.qa/merged.png', fullPage: true });
  await page.getByRole('button', { name: '分别绘图', exact: true }).click();
  await expect(page.locator('.chart-card')).toHaveCount(2);
  expect(runtimeErrors).toEqual([]);
});

test('无效文件提示位置、有效文件仍导入、无表头和移除文件', async ({ page }) => {
  await page.goto('/');
  await load(page, ['public/examples/invalid.csv', 'public/examples/no-header.txt']);
  await expect(page.getByRole('alert')).toContainText('第 3 行第 2 列');
  await expect(page.locator('.chart-card')).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Curve 1 曲线名称' })).toHaveValue('Curve 1');
  await page.getByRole('button', { name: '移除 no-header.txt' }).click();
  await expect(page.locator('.chart-card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '让仿真数据成为清晰的波形' })).toBeVisible();
});

test('笔记本尺寸与示例数据入口', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: '加载示例数据', exact: true }).click();
  await expect(page.locator('.chart-card')).toHaveCount(2);
  await expect(page.locator('.chart-actions button').first()).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
  await page.screenshot({ path: '.qa/laptop.png', fullPage: true });
});

test('拖入文件自动绘图，未支持格式明确提示', async ({ page }) => {
  await page.goto('/');
  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['Time/s,A\n4,2\n4.7,9'], 'dropped.CSV', { type: 'text/csv' }));
    transfer.items.add(new File(['unsupported'], 'pscad.out'));
    return transfer;
  });
  await page.locator('.app-shell').dispatchEvent('drop', { dataTransfer });
  await expect(page.locator('.chart-card')).toHaveCount(1);
  await expect(page.locator('.chart-actions button').first()).toBeEnabled();
  await expect(page.getByRole('alert')).toContainText('PSCAD .out / .inf');
  expect(await page.locator('.plot-area').evaluate(element => (element as unknown as { data: { x: number[] }[] }).data[0].x)).toEqual([4, 4.7]);
  await dataTransfer.dispose();
});
