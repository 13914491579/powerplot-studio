import { test, expect } from '@playwright/test';
import path from 'node:path';

test('公网首页刷新、无严重错误、导入数据不产生上传请求', async ({ page }) => {
  const errors: string[] = [];
  const requests: { url: string; method: string }[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push({ url: request.url(), method: request.method() }); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '波形工作区' })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(path.resolve('public/examples/multi-signal.csv'));
  await expect(page.locator('.chart-actions button').first()).toBeEnabled();
  const origin = new URL(page.url()).origin;
  expect(requests.filter(request => request.method !== 'GET' || new URL(request.url).origin !== origin)).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: '波形工作区' })).toBeVisible();
  expect(errors).toEqual([]);
});
