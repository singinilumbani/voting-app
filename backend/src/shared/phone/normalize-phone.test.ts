import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizePhone, parsePhoneList } from './normalize-phone.js';

interface PhoneVector {
  input: string;
  expected:
    | {
        ok: true;
        canonical: string;
        display: string;
        whatsappUrl?: string;
        isInternational: boolean;
      }
    | { ok: false; reason: string };
}

const vectors = JSON.parse(
  readFileSync(new URL('../../../docs/test-vectors/phone-normalizer.json', import.meta.url), 'utf8')
) as PhoneVector[];

describe('normalizePhone shared vectors', () => {
  it.each(vectors)('normalizes $input', ({ input, expected }) => {
    const result = normalizePhone(input);
    if (expected.ok) {
      expect(result).toMatchObject({
        ...expected,
        whatsappUrl: expected.whatsappUrl ?? `https://wa.me/${expected.canonical}`
      });
    } else {
      expect(result).toEqual(expected);
    }
  });
});

describe('parsePhoneList', () => {
  it('extracts, repairs, and de-duplicates phone entries', () => {
    const result = parsePhoneList(
      'Mary 0991234567\n0991 234 567, +265 99 123 4567; Invalid 9.91E+11'
    );

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.result.canonical).toBe('265991234567');
    expect(result.fixed).toHaveLength(1);
    expect(result.fixed[0]?.original).toBe('Mary 0991234567');
    expect(result.duplicatesMerged).toBe(2);
    expect(result.needsAttention).toEqual([
      { original: 'Invalid 9.91E+11', reason: 'SPREADSHEET_DAMAGED' }
    ]);
  });

  it('accepts tab and semicolon separators and ignores empty segments', () => {
    const result = parsePhoneList('\tMary 0991234567;\n');
    expect(result.valid).toHaveLength(1);
    expect(result.needsAttention).toHaveLength(0);
  });

  it('returns an empty result for an empty list', () => {
    expect(parsePhoneList(' \n,\t;')).toEqual({
      valid: [],
      fixed: [],
      needsAttention: [],
      duplicatesMerged: 0
    });
  });
});
