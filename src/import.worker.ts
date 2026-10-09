import { parseText } from './parser';
self.onmessage = async ({ data }: MessageEvent<{ file: File; id: string }>) => {
  try { self.postMessage({ ok: true, dataset: { ...parseText(await data.file.text()), id: data.id, filename: data.file.name } }); }
  catch (error) { self.postMessage({ ok: false, error: error instanceof Error ? error.message : '读取失败' }); }
};
