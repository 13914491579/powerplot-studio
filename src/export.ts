import type { PlotlyHTMLElement } from 'plotly.js';
import type { PlotConfig } from './config';
import { inches, pixelSize, validateConfig } from './config';
import { withDpi } from './png';
export type Format = 'png' | 'svg' | 'pdf';
export interface Exporter { name: string; export: (format: Format) => Promise<Blob>; ranges: () => { x: number[]; xPanels: number[][]; y: number[][] } }
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function uniqueNames(names: string[], extension: string) {
  const used = new Set<string>();
  return names.map(name => {
    const base = name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '') || 'PowerPlot';
    let candidate = `${base}.${extension}`, index = 2;
    while (used.has(candidate.toLowerCase())) candidate = `${base}-${index++}.${extension}`;
    used.add(candidate.toLowerCase()); return candidate;
  });
}
let fontPromise: Promise<string> | undefined;
async function pdfFont() {
  fontPromise ??= (async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}fonts/NotoSansSC-Regular.ttf`);
    if (!response.ok) throw new Error('PDF 中文字体加载失败，请检查本地字体文件。');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  })().catch(error => { fontPromise = undefined; throw error; });
  return fontPromise;
}
export async function exportChart(gd: PlotlyHTMLElement, config: PlotConfig, format: Format): Promise<Blob> {
  const errors = validateConfig(config); if (errors.length) throw new Error(errors.join(' '));
  // Capture the displayed ranges before any asynchronous font/PDF work.
  const layout = structuredClone(gd.layout);
  const data = gd.data.map(trace => ({ ...trace }));
  await document.fonts.ready;
  const { default: Plotly } = await import('plotly.js-basic-dist-min');
  const size = inches(config.size);
  const render = document.createElement('div'); render.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none'; document.body.append(render);
  let svgText: string;
  try {
    await Plotly.newPlot(render, data, { ...layout, width: size.width * 96, height: size.height * 96 }, { staticPlot: true, displayModeBar: false });
    const dataUrl = await Plotly.toImage(render, { format: 'svg', width: size.width * 96, height: size.height * 96, scale: 1 });
    svgText = await (await fetch(dataUrl)).text();
  } finally { Plotly.purge(render); render.remove(); }
  const physicalSvg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  physicalSvg.setAttribute('viewBox', `0 0 ${size.width * 96} ${size.height * 96}`);
  physicalSvg.setAttribute('width', `${size.width}in`); physicalSvg.setAttribute('height', `${size.height}in`);
  if (config.font.family === 'Noto Sans SC') {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `@font-face{font-family:'Noto Sans SC';src:url(data:font/ttf;base64,${await pdfFont()}) format('truetype');font-weight:400}`;
    physicalSvg.prepend(style);
  }
  svgText = new XMLSerializer().serializeToString(physicalSvg);
  if (format === 'svg') return new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  if (format === 'png') {
    const dimensions = pixelSize(config.size); const canvas = document.createElement('canvas'); canvas.width = dimensions.width; canvas.height = dimensions.height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器不能创建 PNG 画布。');
    const image = new Image(); const source = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('SVG 栅格化失败。')); image.src = source; });
      context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG 编码失败。')), 'image/png'));
      const output = withDpi(new Uint8Array(await blob.arrayBuffer()), config.size.dpi);
      return new Blob([output as Uint8Array<ArrayBuffer>], { type: 'image/png' });
    } finally { URL.revokeObjectURL(source); canvas.width = canvas.height = 0; }
  }
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
  const width = size.width * 72, height = size.height * 72;
  const pdf = new jsPDF({ orientation: width >= height ? 'landscape' : 'portrait', unit: 'pt', format: [width, height], compress: true, putOnlyUsedFonts: true });
  const unicode = Array.from(svg.querySelectorAll('text')).some(t => /[^\x20-\x7e]/.test(t.textContent || '')) || config.font.family === 'Noto Sans SC';
  if (unicode) { pdf.addFileToVFS('NotoSansSC.ttf', await pdfFont()); pdf.addFont('NotoSansSC.ttf', 'PowerPlotCJK', 'normal'); pdf.setFont('PowerPlotCJK'); }
  for (const text of svg.querySelectorAll('text')) {
    const family = /[^\x20-\x7e]/.test(text.textContent || '') || config.font.family === 'Noto Sans SC' ? 'PowerPlotCJK' : config.font.family.includes('Times') ? 'times' : config.font.family.includes('Courier') ? 'courier' : 'helvetica';
    if (family === 'PowerPlotCJK') for (const char of Array.from(text.textContent || '')) {
      const code = char.codePointAt(0)!;
      if (!/\s/.test(char) && (code > 0xffff || !pdf.getFont().metadata.characterToGlyph(code))) throw new Error(`PDF 字体不支持字符“${char}”，请替换该标签字符或导出 SVG。`);
    }
    text.style.fontFamily = family; text.style.fontWeight = 'normal'; text.style.fontStyle = 'normal';
    text.querySelectorAll('tspan').forEach(span => { span.style.fontFamily = family; span.style.fontWeight = 'normal'; });
  }
  await pdf.svg(svg, { x: 0, y: 0, width, height });
  return pdf.output('blob');
}
export async function exportZip(exporters: Exporter[], format: Format, progress: (completed: number) => void): Promise<Blob> {
  const { default: JSZip } = await import('jszip'); const zip = new JSZip(); const names = uniqueNames(exporters.map(e => e.name), format);
  for (const [i, exporter] of exporters.entries()) { zip.file(names[i], await (await exporter.export(format)).arrayBuffer()); progress(i + 1); }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } });
}
