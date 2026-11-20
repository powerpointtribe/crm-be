export type ImageKind = 'jpeg' | 'png' | 'webp';

/**
 * Detect JPEG, PNG or WebP from the file's first bytes. The client-sent
 * `mimetype` is just a header, so it can't be trusted on its own.
 * Returns null for anything else (including HEIC, GIF, SVG).
 */
export function detectImageKind(buf: Buffer | undefined): ImageKind | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}
