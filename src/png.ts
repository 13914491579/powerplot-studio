function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
export function withDpi(png: Uint8Array, dpi: number): Uint8Array {
  const chunk = new Uint8Array(21); const view = new DataView(chunk.buffer);
  view.setUint32(0, 9); chunk.set(new TextEncoder().encode('pHYs'), 4);
  view.setUint32(8, Math.round(dpi / .0254)); view.setUint32(12, Math.round(dpi / .0254)); chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const parts: Uint8Array[] = [png.subarray(0, 33), chunk];
  for (let offset = 33; offset < png.length;) {
    const length = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0) + 12;
    if (new TextDecoder().decode(png.subarray(offset + 4, offset + 8)) !== 'pHYs') parts.push(png.subarray(offset, offset + length));
    offset += length;
  }
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}
