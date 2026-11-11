import { deflateSync, inflateSync } from 'node:zlib';
import { AppError } from './app-error.js';

export type SupportedAvatarContentType = 'image/png' | 'image/jpeg' | 'image/webp';

export const MAX_AVATAR_INPUT_BYTES = 2 * 1024 * 1024; // 2 MiB
export const MAX_AVATAR_STORAGE_BYTES = 131_072; // 128 KiB
export const MAX_AVATAR_DIMENSION = 256;
const MAX_SOURCE_DIMENSION = 4096;

export interface NormalizedAvatar {
    data: Buffer;
    contentType: SupportedAvatarContentType;
    width: number;
    height: number;
    byteLength: number;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const STRIPPABLE_PNG_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'pHYs']);

export function normalizeAvatarImage(
    rawInput: Buffer,
    declaredContentType: SupportedAvatarContentType,
): NormalizedAvatar {
    if (!Buffer.isBuffer(rawInput) || rawInput.byteLength === 0) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Avatar image payload cannot be empty');
    }
    if (rawInput.byteLength > MAX_AVATAR_INPUT_BYTES) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Avatar image exceeds 2 MiB upload limit');
    }

    assertNotSvgOrMarkup(rawInput);

    const detectedType = detectMagicType(rawInput);
    if (!detectedType || detectedType !== declaredContentType) {
        throw new AppError(
            422,
            'VALIDATION_ERROR',
            'Avatar image signature does not match supported PNG, JPEG, or WebP format',
        );
    }

    if (detectedType === 'image/png') {
        return normalizePng(rawInput);
    }
    if (detectedType === 'image/jpeg') {
        return normalizeJpeg(rawInput);
    }
    return normalizeWebp(rawInput);
}

function assertNotSvgOrMarkup(buf: Buffer): void {
    const head = buf
        .subarray(0, Math.min(buf.byteLength, 512))
        .toString('utf8')
        .trimStart()
        .toLowerCase();
    if (
        head.startsWith('<svg') ||
        head.startsWith('<?xml') ||
        head.startsWith('<!doctype') ||
        head.startsWith('<html')
    ) {
        throw new AppError(422, 'VALIDATION_ERROR', 'SVG and HTML payloads are not permitted');
    }
}

function detectMagicType(buf: Buffer): SupportedAvatarContentType | null {
    if (buf.byteLength >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
        return 'image/png';
    }
    if (buf.byteLength >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return 'image/jpeg';
    }
    if (
        buf.byteLength >= 12 &&
        buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buf.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
        return 'image/webp';
    }
    return null;
}

function validateDimensions(width: number, height: number): void {
    if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width < 1 ||
        height < 1 ||
        width > MAX_SOURCE_DIMENSION ||
        height > MAX_SOURCE_DIMENSION
    ) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Avatar image dimensions are invalid');
    }
}

function normalizePng(buf: Buffer): NormalizedAvatar {
    interface PngChunk {
        type: string;
        data: Buffer;
    }

    const chunks: PngChunk[] = [];
    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    let seenIhdr = false;
    let seenIend = false;

    while (offset + 12 <= buf.byteLength) {
        const length = buf.readUInt32BE(offset);
        const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        const crcEnd = dataEnd + 4;
        if (crcEnd > buf.byteLength) {
            throw new AppError(422, 'VALIDATION_ERROR', 'Corrupted PNG chunk length');
        }
        const data = buf.subarray(dataStart, dataEnd);

        if (type === 'IHDR') {
            if (length !== 13 || seenIhdr) {
                throw new AppError(422, 'VALIDATION_ERROR', 'Invalid PNG IHDR chunk');
            }
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
            const compression = data[10];
            const filter = data[11];
            interlace = data[12];
            if (compression !== 0 || filter !== 0) {
                throw new AppError(422, 'VALIDATION_ERROR', 'Unsupported PNG encoding');
            }
            validateDimensions(width, height);
            seenIhdr = true;
        }

        if (!STRIPPABLE_PNG_CHUNKS.has(type)) {
            chunks.push({ type, data });
        }

        offset = crcEnd;
        if (type === 'IEND') {
            seenIend = true;
            break;
        }
    }

    if (!seenIhdr || !seenIend) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid PNG structure');
    }

    const cleanBuf = buildPngFromChunks(chunks);

    if (
        width <= MAX_AVATAR_DIMENSION &&
        height <= MAX_AVATAR_DIMENSION &&
        cleanBuf.byteLength <= MAX_AVATAR_STORAGE_BYTES
    ) {
        return {
            data: cleanBuf,
            contentType: 'image/png',
            width,
            height,
            byteLength: cleanBuf.byteLength,
        };
    }

    // Attempt pure-Node downscale for standard 8-bit non-interlaced PNGs
    if (
        bitDepth === 8 &&
        interlace === 0 &&
        (colorType === 2 || colorType === 6 || colorType === 0 || colorType === 4)
    ) {
        const idatBuffers = chunks.filter((c) => c.type === 'IDAT').map((c) => c.data);
        const compressed = Buffer.concat(idatBuffers);
        const rawScanlines = inflateSync(compressed, { maxOutputLength: 64 * 1024 * 1024 });
        const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
        const rgba = decodeUnfilteredScanlinesToRgba(rawScanlines, width, height, channels);

        const scale = Math.min(MAX_AVATAR_DIMENSION / width, MAX_AVATAR_DIMENSION / height, 1);
        const targetW = Math.max(1, Math.round(width * scale));
        const targetH = Math.max(1, Math.round(height * scale));
        const resized = downscaleRgba(rgba, width, height, targetW, targetH);
        const encoded = encodeRgbaToPng(resized, targetW, targetH);

        if (encoded.byteLength > MAX_AVATAR_STORAGE_BYTES) {
            throw new AppError(
                422,
                'VALIDATION_ERROR',
                'Normalized avatar image still exceeds 128 KiB limit',
            );
        }

        return {
            data: encoded,
            contentType: 'image/png',
            width: targetW,
            height: targetH,
            byteLength: encoded.byteLength,
        };
    }

    throw new AppError(
        422,
        'VALIDATION_ERROR',
        'PNG avatar exceeds 256x256 dimensions or 128 KiB size limit',
    );
}

function buildPngFromChunks(chunks: { type: string; data: Buffer }[]): Buffer {
    const parts: Buffer[] = [PNG_SIGNATURE];
    for (const chunk of chunks) {
        const header = Buffer.alloc(8);
        header.writeUInt32BE(chunk.data.byteLength, 0);
        header.write(chunk.type, 4, 4, 'ascii');
        const crcInput = Buffer.concat([Buffer.from(chunk.type, 'ascii'), chunk.data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(crcInput) >>> 0, 0);
        parts.push(header, chunk.data, crc);
    }
    return Buffer.concat(parts);
}

function decodeUnfilteredScanlinesToRgba(
    raw: Buffer,
    width: number,
    height: number,
    channels: number,
): Uint8Array {
    const stride = width * channels;
    const expectedLen = height * (stride + 1);
    if (raw.byteLength < expectedLen) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Corrupted PNG image stream');
    }

    const unfiltered = new Uint8Array(height * stride);
    for (let y = 0; y < height; y++) {
        const rowStart = y * (stride + 1);
        const filterType = raw[rowStart];
        const outRow = y * stride;
        const prevRow = (y - 1) * stride;

        for (let i = 0; i < stride; i++) {
            const x = raw[rowStart + 1 + i];
            const a = i >= channels ? unfiltered[outRow + i - channels] : 0;
            const b = y > 0 ? unfiltered[prevRow + i] : 0;
            const c = y > 0 && i >= channels ? unfiltered[prevRow + i - channels] : 0;

            let val = x;
            if (filterType === 1) val = (x + a) & 0xff;
            else if (filterType === 2) val = (x + b) & 0xff;
            else if (filterType === 3) val = (x + ((a + b) >> 1)) & 0xff;
            else if (filterType === 4) val = (x + paeth(a, b, c)) & 0xff;
            else if (filterType !== 0) {
                throw new AppError(422, 'VALIDATION_ERROR', 'Invalid PNG scanline filter');
            }
            unfiltered[outRow + i] = val;
        }
    }

    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0, p = 0; p < width * height; p++, i += channels) {
        if (channels === 4) {
            rgba[p * 4] = unfiltered[i];
            rgba[p * 4 + 1] = unfiltered[i + 1];
            rgba[p * 4 + 2] = unfiltered[i + 2];
            rgba[p * 4 + 3] = unfiltered[i + 3];
        } else if (channels === 3) {
            rgba[p * 4] = unfiltered[i];
            rgba[p * 4 + 1] = unfiltered[i + 1];
            rgba[p * 4 + 2] = unfiltered[i + 2];
            rgba[p * 4 + 3] = 255;
        } else if (channels === 2) {
            rgba[p * 4] = unfiltered[i];
            rgba[p * 4 + 1] = unfiltered[i];
            rgba[p * 4 + 2] = unfiltered[i];
            rgba[p * 4 + 3] = unfiltered[i + 1];
        } else {
            rgba[p * 4] = unfiltered[i];
            rgba[p * 4 + 1] = unfiltered[i];
            rgba[p * 4 + 2] = unfiltered[i];
            rgba[p * 4 + 3] = 255;
        }
    }
    return rgba;
}

function paeth(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

function downscaleRgba(
    src: Uint8Array,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number,
): Uint8Array {
    const out = new Uint8Array(dstW * dstH * 4);
    for (let y = 0; y < dstH; y++) {
        const y0 = Math.floor((y * srcH) / dstH);
        const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * srcH) / dstH));
        for (let x = 0; x < dstW; x++) {
            const x0 = Math.floor((x * srcW) / dstW);
            const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * srcW) / dstW));
            let r = 0,
                g = 0,
                b = 0,
                a = 0,
                count = 0;
            for (let sy = y0; sy < y1; sy++) {
                for (let sx = x0; sx < x1; sx++) {
                    const idx = (sy * srcW + sx) * 4;
                    r += src[idx];
                    g += src[idx + 1];
                    b += src[idx + 2];
                    a += src[idx + 3];
                    count++;
                }
            }
            const dstIdx = (y * dstW + x) * 4;
            out[dstIdx] = Math.round(r / count);
            out[dstIdx + 1] = Math.round(g / count);
            out[dstIdx + 2] = Math.round(b / count);
            out[dstIdx + 3] = Math.round(a / count);
        }
    }
    return out;
}

function encodeRgbaToPng(rgba: Uint8Array, width: number, height: number): Buffer {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const stride = width * 4;
    const raw = Buffer.alloc(height * (stride + 1));
    for (let y = 0; y < height; y++) {
        const dstOffset = y * (stride + 1);
        raw[dstOffset] = 0;
        Buffer.from(rgba.subarray(y * stride, (y + 1) * stride)).copy(raw, dstOffset + 1);
    }

    const idat = deflateSync(raw, { level: 9 });
    return buildPngFromChunks([
        { type: 'IHDR', data: ihdr },
        { type: 'IDAT', data: idat },
        { type: 'IEND', data: Buffer.alloc(0) },
    ]);
}

function normalizeJpeg(buf: Buffer): NormalizedAvatar {
    const outSegments: Buffer[] = [Buffer.from([0xff, 0xd8])];
    let offset = 2;
    let width = 0;
    let height = 0;

    while (offset + 1 < buf.byteLength) {
        if (buf[offset] !== 0xff) {
            throw new AppError(422, 'VALIDATION_ERROR', 'Corrupted JPEG marker stream');
        }
        while (offset < buf.byteLength && buf[offset] === 0xff) offset++;
        if (offset >= buf.byteLength) break;
        const marker = buf[offset];
        offset++;

        if (marker === 0xd9) {
            // EOI
            outSegments.push(Buffer.from([0xff, 0xd9]));
            break;
        }
        if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
            outSegments.push(Buffer.from([0xff, marker]));
            continue;
        }
        if (marker === 0xda) {
            // SOS - copy remaining entropy-coded data up to EOI
            outSegments.push(Buffer.from([0xff, marker]), buf.subarray(offset));
            break;
        }

        if (offset + 2 > buf.byteLength) {
            throw new AppError(422, 'VALIDATION_ERROR', 'Corrupted JPEG segment');
        }
        const segLen = buf.readUInt16BE(offset);
        if (segLen < 2 || offset + segLen > buf.byteLength) {
            throw new AppError(422, 'VALIDATION_ERROR', 'Corrupted JPEG segment length');
        }

        const payload = buf.subarray(offset + 2, offset + segLen);
        // SOF0 / SOF1 / SOF2
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            if (payload.byteLength < 5) {
                throw new AppError(422, 'VALIDATION_ERROR', 'Invalid JPEG SOF frame');
            }
            height = payload.readUInt16BE(1);
            width = payload.readUInt16BE(3);
            validateDimensions(width, height);
        }

        // Strip EXIF/XMP/IPTC/Comment (APP1..APP15, COM) while keeping APP0 (JFIF)
        const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
        if (!isMetadata) {
            const hdr = Buffer.alloc(4);
            hdr[0] = 0xff;
            hdr[1] = marker;
            hdr.writeUInt16BE(segLen, 2);
            outSegments.push(hdr, payload);
        }

        offset += segLen;
    }

    validateDimensions(width, height);
    if (width > MAX_AVATAR_DIMENSION || height > MAX_AVATAR_DIMENSION) {
        throw new AppError(
            422,
            'VALIDATION_ERROR',
            'JPEG avatar exceeds maximum dimensions of 256x256',
        );
    }

    const cleaned = Buffer.concat(outSegments);
    if (cleaned.byteLength > MAX_AVATAR_STORAGE_BYTES) {
        throw new AppError(422, 'VALIDATION_ERROR', 'JPEG avatar exceeds 128 KiB size limit');
    }

    return {
        data: cleaned,
        contentType: 'image/jpeg',
        width,
        height,
        byteLength: cleaned.byteLength,
    };
}

function normalizeWebp(buf: Buffer): NormalizedAvatar {
    let offset = 12;
    let width = 0;
    let height = 0;
    const keptChunks: Buffer[] = [];
    const metadataChunkIds = new Set(['EXIF', 'XMP ']);

    while (offset + 8 <= buf.byteLength) {
        const chunkId = buf.subarray(offset, offset + 4).toString('ascii');
        const chunkSize = buf.readUInt32LE(offset + 4);
        const paddedSize = chunkSize + (chunkSize % 2);
        const dataStart = offset + 8;
        const dataEnd = dataStart + chunkSize;
        if (dataStart + paddedSize > buf.byteLength) {
            throw new AppError(422, 'VALIDATION_ERROR', 'Corrupted WebP chunk');
        }
        const payload = buf.subarray(dataStart, dataEnd);

        if (chunkId === 'VP8X' && payload.byteLength >= 10) {
            width = 1 + (payload[4] | (payload[5] << 8) | (payload[6] << 16));
            height = 1 + (payload[7] | (payload[8] << 8) | (payload[9] << 16));
        } else if (chunkId === 'VP8 ' && payload.byteLength >= 10) {
            width = payload.readUInt16LE(6) & 0x3fff;
            height = payload.readUInt16LE(8) & 0x3fff;
        } else if (chunkId === 'VP8L' && payload.byteLength >= 5 && payload[0] === 0x2f) {
            const bits = payload.readUInt32LE(1);
            width = (bits & 0x3fff) + 1;
            height = ((bits >> 14) & 0x3fff) + 1;
        }

        if (!metadataChunkIds.has(chunkId)) {
            const chunkBuf = Buffer.alloc(8 + paddedSize);
            buf.subarray(offset, offset + 8 + chunkSize).copy(chunkBuf);
            keptChunks.push(chunkBuf);
        }

        offset = dataStart + paddedSize;
    }

    validateDimensions(width, height);
    if (width > MAX_AVATAR_DIMENSION || height > MAX_AVATAR_DIMENSION) {
        throw new AppError(
            422,
            'VALIDATION_ERROR',
            'WebP avatar exceeds maximum dimensions of 256x256',
        );
    }

    const body = Buffer.concat(keptChunks);
    const header = Buffer.alloc(12);
    header.write('RIFF', 0, 4, 'ascii');
    header.writeUInt32LE(4 + body.byteLength, 4);
    header.write('WEBP', 8, 4, 'ascii');
    const cleaned = Buffer.concat([header, body]);

    if (cleaned.byteLength > MAX_AVATAR_STORAGE_BYTES) {
        throw new AppError(422, 'VALIDATION_ERROR', 'WebP avatar exceeds 128 KiB size limit');
    }

    return {
        data: cleaned,
        contentType: 'image/webp',
        width,
        height,
        byteLength: cleaned.byteLength,
    };
}

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.byteLength; i++) {
        crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
