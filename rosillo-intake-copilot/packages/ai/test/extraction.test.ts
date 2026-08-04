import { describe, it, expect } from 'vitest';
import { MockOcrAdapter, PassthroughExtractor, MIN_OCR_CONFIDENCE } from '../src';
import type { AttachmentInput } from '@rosillo/domain';

const att = (over: Partial<AttachmentInput>): AttachmentInput => ({
  id: 'a1',
  filename: 'foto.jpg',
  mimeType: 'image/jpeg',
  text: '',
  hash: 'h',
  ...over,
});

describe('attachment extraction seam (OCR deferred — ADR-0005)', () => {
  it('passthrough returns already-extracted text with deterministic provenance', async () => {
    const extractor = new PassthroughExtractor();
    expect(extractor.supports('application/pdf')).toBe(true);
    expect(extractor.supports('image/jpeg')).toBe(false);
    const result = await extractor.extract(att({ mimeType: 'application/pdf', text: 'hola' }));
    expect(result).toMatchObject({ status: 'EXTRACTED', text: 'hola', confidence: 1, provenance: 'passthrough-v1' });
  });

  it('mock OCR extracts canned text above the confidence threshold', async () => {
    const ocr = new MockOcrAdapter({ 'foto.jpg': { text: 'MATRÍCULA 1234-XYZ', confidence: 0.93 } });
    const result = await ocr.extract(att({}));
    expect(result.status).toBe('EXTRACTED');
    expect(result.provenance).toBe('mock-ocr-v1');
  });

  it('fails safe (REJECTED, empty text) below the confidence threshold', async () => {
    const ocr = new MockOcrAdapter({ 'foto.jpg': { text: 'texto dudoso', confidence: 0.4 } });
    const result = await ocr.extract(att({}));
    expect(result.status).toBe('REJECTED');
    expect(result.text).toBe('');
    expect(result.confidence).toBeLessThan(MIN_OCR_CONFIDENCE);
    expect(result.reason).toMatch(/fail safe/i);
  });

  it('reports NO_TEXT for unknown images instead of inventing content', async () => {
    const ocr = new MockOcrAdapter();
    const result = await ocr.extract(att({ filename: 'desconocida.png', mimeType: 'image/png' }));
    expect(result.status).toBe('NO_TEXT');
    expect(result.text).toBe('');
  });
});
