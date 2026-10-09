import type { Dataset } from './parser';

export function importFile(file: File): Promise<Dataset> {
  if (!/\.(txt|csv)$/i.test(file.name)) return Promise.reject(new Error('当前支持 TXT / CSV 文件；PSCAD .out / .inf 将在后续版本支持。'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.ok) resolve(data.dataset);
      else reject(new Error(data.error));
    };
    worker.onerror = () => { worker.terminate(); reject(new Error('解析线程运行失败，请重新导入文件。')); };
    worker.postMessage({ file, id: crypto.randomUUID() });
  });
}
