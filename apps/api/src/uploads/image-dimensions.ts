export function readImageDimensions(
  content: Buffer,
  contentType: string,
): { width: number; height: number } | null {
  if (
    contentType === "image/png" &&
    content.length >= 24 &&
    content.toString("ascii", 1, 4) === "PNG"
  ) {
    return { width: content.readUInt32BE(16), height: content.readUInt32BE(20) };
  }

  if (contentType === "image/jpeg" && content.length >= 4 && content[0] === 0xff && content[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < content.length) {
      if (content[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = content[offset + 1];
      const length = content.readUInt16BE(offset + 2);
      if (marker !== undefined && marker >= 0xc0 && marker <= 0xc3) {
        return { height: content.readUInt16BE(offset + 5), width: content.readUInt16BE(offset + 7) };
      }
      if (length < 2) return null;
      offset += 2 + length;
    }
  }

  if (
    contentType === "image/webp" &&
    content.length >= 30 &&
    content.toString("ascii", 0, 4) === "RIFF" &&
    content.toString("ascii", 8, 12) === "WEBP"
  ) {
    const format = content.toString("ascii", 12, 16);
    if (format === "VP8X") {
      return {
        width: 1 + content.readUIntLE(24, 3),
        height: 1 + content.readUIntLE(27, 3),
      };
    }
    if (format === "VP8 " && content.length >= 30 && content[23] === 0x9d && content[24] === 0x01 && content[25] === 0x2a) {
      return {
        width: content.readUInt16LE(26) & 0x3fff,
        height: content.readUInt16LE(28) & 0x3fff,
      };
    }
    if (format === "VP8L" && content.length >= 25 && content[20] === 0x2f) {
      const byte1 = content[21] ?? 0;
      const byte2 = content[22] ?? 0;
      const byte3 = content[23] ?? 0;
      const byte4 = content[24] ?? 0;
      return {
        width: 1 + (((byte2 & 0x3f) << 8) | byte1),
        height: 1 + (((byte4 & 0x0f) << 10) | (byte3 << 2) | ((byte2 & 0xc0) >> 6)),
      };
    }
  }

  return null;
}
