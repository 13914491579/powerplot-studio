export interface Signal { name: string; values: number[] }
export interface ParsedData { time: number[]; timeLabel: string; signals: Signal[] }
export interface Dataset extends ParsedData { id: string; filename: string }
const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const isNumber = (s: string) => numeric.test(s) && Number.isFinite(Number(s));
// Strict parsing: never skip a malformed row or reconstruct timestamps.
export function parseText(text: string): ParsedData {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).map((value, i) => ({ value: value.trim(), line: i + 1 })).filter(r => r.value);
  if (!lines.length) throw new Error('文件为空或仅包含空白字符。');
  const delimiter = lines[0].value.includes(',') ? ',' : lines[0].value.includes('\t') ? '\t' : null;
  const split = (s: string) => (delimiter ? s.split(delimiter) : s.split(/\s+/)).map(v => v.trim());
  const first = split(lines[0].value);
  if (first.length < 2) throw new Error('至少需要两列：时间列和一个信号列。');
  const header = first.every(v => v.length > 0 && !isNumber(v)) && !isNumber(first[0]);
  if (!header && !first.every(isNumber)) throw new Error(`第 ${lines[0].line} 行包含无效数字或混合表头。`);
  const result: ParsedData = { time: [], timeLabel: header ? first[0] : 'Time', signals: first.slice(1).map((name, i) => ({ name: header ? name : `Curve ${i + 1}`, values: [] })) };
  for (const row of lines.slice(header ? 1 : 0)) {
    const cells = split(row.value);
    if (cells.length !== first.length) throw new Error(`第 ${row.line} 行列数不一致：应为 ${first.length} 列，实际 ${cells.length} 列。`);
    cells.forEach((v, i) => { if (!isNumber(v)) throw new Error(`第 ${row.line} 行第 ${i + 1} 列不是有效的有限数字：${v || '空值'}。`); });
    result.time.push(Number(cells[0]));
    result.signals.forEach((s, i) => s.values.push(Number(cells[i + 1])));
  }
  if (!result.time.length) throw new Error('文件只有表头，没有数据。');
  return result;
}
// Future adapters for PSCAD .out/.inf can implement this interface.
export interface DataAdapter { extensions: string[]; parse: (text: string) => ParsedData }
export const textAdapter: DataAdapter = { extensions: ['txt', 'csv'], parse: parseText };
