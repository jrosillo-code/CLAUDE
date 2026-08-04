import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { caseFixtureSchema, type CaseFixture } from '../schemas';
import type { AttachmentInput, CommunicationInput } from '../types';
import { sha256 } from '../pipeline';

/**
 * Loads synthetic case fixtures from fixtures/emails plus attachment text
 * stand-ins from fixtures/attachments (`<filename>.txt` holds the extracted
 * text for document attachments; image attachments have no text).
 * Every fixture must be marked SYNTHETIC — anything else is rejected.
 */

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface LoadedFixture {
  fixture: CaseFixture;
  communication: CommunicationInput;
}

export function loadCaseFixtures(fixturesRoot: string): LoadedFixture[] {
  const emailsDir = join(fixturesRoot, 'emails');
  const attachmentsDir = join(fixturesRoot, 'attachments');
  const files = readdirSync(emailsDir).filter((f) => f.endsWith('.json')).sort();

  return files.map((file) => {
    const raw = JSON.parse(readFileSync(join(emailsDir, file), 'utf8'));
    const fixture = caseFixtureSchema.parse(raw);
    if (fixture.classification !== 'SYNTHETIC') {
      throw new Error(`Fixture ${fixture.case_id} is not marked SYNTHETIC — refusing to load.`);
    }

    const attachments: AttachmentInput[] = fixture.attachments.map((filename, i) => {
      const ext = filename.split('.').pop()?.toLowerCase() ?? '';
      const textPath = join(attachmentsDir, `${filename}.txt`);
      const text = existsSync(textPath) ? readFileSync(textPath, 'utf8') : '';
      return {
        id: `${fixture.case_id}-att-${i + 1}`,
        filename,
        mimeType: MIME_BY_EXT[ext] ?? 'application/octet-stream',
        text,
        hash: sha256(`${filename}:${text}`),
      };
    });

    const communication: CommunicationInput = {
      id: `${fixture.case_id}-comm`,
      from: fixture.from,
      subject: fixture.subject,
      bodyText: fixture.body,
      receivedAt: fixture.received_at,
      attachments,
    };

    return { fixture, communication };
  });
}
