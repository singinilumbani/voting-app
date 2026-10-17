import {
  MOBILE_NATIONAL_PREFIXES,
  NATIONAL_NUMBER_LENGTH,
  PHONE_NUMBER_RULE
} from '../constants.js';
import type {
  PhoneListResult,
  PhoneNormalizationError,
  PhoneNormalizationResult,
  PhoneNormalizationSuccess
} from '../schemas.js';

const invisibleCharacters = /\p{Cf}/gu;
const phoneSeparators = /[\s().-]/gu;
const spreadsheetScientificNotation = /^\s*\+?\d+(?:\.\d+)?e[+-]?\d+\s*$/iu;
const embeddedSpreadsheetNotation = /\d+(?:\.\d+)?e[+-]?\d+/iu;
const candidateStartPattern = /(?:tel:\s*)?(?:\+\s*)?(?:00)?\d/iu;

function failure(reason: PhoneNormalizationError): PhoneNormalizationResult {
  return { ok: false, reason };
}

function makeMalawiResult(nationalNumber: string): PhoneNormalizationSuccess {
  const canonical = `${PHONE_NUMBER_RULE.countryCallingCode}${nationalNumber}`;
  return {
    ok: true,
    canonical,
    display: `0${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`,
    whatsappUrl: `https://wa.me/${canonical}`,
    isInternational: false
  };
}

function normalizeInternational(digits: string): PhoneNormalizationSuccess {
  return {
    ok: true,
    canonical: digits,
    display: `+${digits}`,
    whatsappUrl: `https://wa.me/${digits}`,
    isInternational: true
  };
}

/**
 * Normalize local/international phone input to canonical digits.
 * Malawi mobile numbers use a 9-digit national number beginning with 8 or 9.
 * Explicit non-Malawi international numbers (8–15 digits) display as +digits;
 * all WhatsApp links use canonical digits without a plus sign.
 */
export function normalizePhone(input: string): PhoneNormalizationResult {
  if (input.trim().length === 0) {
    return failure('EMPTY');
  }
  if (spreadsheetScientificNotation.test(input.replace(invisibleCharacters, ''))) {
    return failure('SPREADSHEET_DAMAGED');
  }

  let cleaned = input.replace(invisibleCharacters, '').trim();
  cleaned = cleaned.replace(/^tel:/iu, '').trim();

  let explicitlyInternational = false;
  if (cleaned.startsWith('+')) {
    explicitlyInternational = true;
    cleaned = cleaned.slice(1);
  }

  cleaned = cleaned.replace(phoneSeparators, '');
  if (cleaned.startsWith('00')) {
    explicitlyInternational = true;
    cleaned = cleaned.slice(2);
  }
  if (cleaned.length === 0) {
    return failure('EMPTY');
  }
  if (!/^\d+$/u.test(cleaned)) {
    return failure('INVALID_CHARACTERS');
  }
  if (cleaned.length > 15) {
    return failure('TOO_LONG');
  }

  if (cleaned.startsWith(PHONE_NUMBER_RULE.countryCallingCode)) {
    let nationalNumber = cleaned.slice(PHONE_NUMBER_RULE.countryCallingCode.length);
    if (nationalNumber.startsWith('0')) {
      nationalNumber = nationalNumber.slice(1);
    }
    if (nationalNumber.startsWith(PHONE_NUMBER_RULE.countryCallingCode)) {
      return failure('NOT_MOBILE');
    }
    return validateMalawiNationalNumber(nationalNumber);
  }

  if (cleaned.startsWith('0')) {
    const nationalNumber = cleaned.slice(1);
    if (nationalNumber.length === NATIONAL_NUMBER_LENGTH - 2 && nationalNumber.startsWith('1')) {
      return failure('NOT_MOBILE');
    }
    return validateMalawiNationalNumber(nationalNumber);
  }

  if (explicitlyInternational && cleaned.length >= 8 && cleaned.length <= 15) {
    return normalizeInternational(cleaned);
  }

  if (cleaned.length === NATIONAL_NUMBER_LENGTH) {
    return validateMalawiNationalNumber(cleaned);
  }
  if (
    !explicitlyInternational &&
    cleaned.length === NATIONAL_NUMBER_LENGTH - 2 &&
    cleaned.startsWith('1')
  ) {
    return failure('NOT_MOBILE');
  }
  if (cleaned.length < PHONE_NUMBER_RULE.nationalNumberLength) {
    return failure('TOO_SHORT');
  }
  return failure('TOO_LONG');
}

function validateMalawiNationalNumber(nationalNumber: string): PhoneNormalizationResult {
  if (nationalNumber.length === NATIONAL_NUMBER_LENGTH - 2 && nationalNumber.startsWith('1')) {
    return failure('NOT_MOBILE');
  }
  if (nationalNumber.length < NATIONAL_NUMBER_LENGTH) {
    return failure('TOO_SHORT');
  }
  if (nationalNumber.length > NATIONAL_NUMBER_LENGTH) {
    return failure('TOO_LONG');
  }
  if (!MOBILE_NATIONAL_PREFIXES.some((prefix) => nationalNumber.startsWith(prefix))) {
    return failure('NOT_MOBILE');
  }
  return makeMalawiResult(nationalNumber);
}

function extractCandidates(segment: string): string[] {
  const scientificNotation = segment
    .replace(invisibleCharacters, '')
    .match(embeddedSpreadsheetNotation);
  if (scientificNotation) {
    return [scientificNotation[0]];
  }

  const candidates: string[] = [];
  const matcher = new RegExp(candidateStartPattern.source, 'giu');
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(segment)) !== null) {
    const start = match.index;
    const prefix = match[0];
    let end = start + prefix.length;
    while (end < segment.length && /[\d\s().-]/u.test(segment[end] ?? '')) {
      end += 1;
    }
    const candidate = segment.slice(start, end).trim();
    if (candidate.length > 0) {
      candidates.push(candidate);
    }
    matcher.lastIndex = end;
  }
  return candidates;
}

export function parsePhoneList(text: string): PhoneListResult {
  const valid: PhoneListResult['valid'] = [];
  const fixed: PhoneListResult['fixed'] = [];
  const needsAttention: PhoneListResult['needsAttention'] = [];
  const seen = new Set<string>();
  let duplicatesMerged = 0;

  const segments = text.split(/[\n,;\t]+/u);
  for (const rawSegment of segments) {
    const original = rawSegment.trim();
    if (!original) {
      continue;
    }

    const candidates = extractCandidates(original);
    if (candidates.length === 0) {
      if (/\d/u.test(original)) {
        const result = normalizePhone(original);
        if (!result.ok) {
          needsAttention.push({ original, reason: result.reason });
        }
      }
      continue;
    }

    for (const candidate of candidates) {
      const result = normalizePhone(candidate);
      if (!result.ok) {
        needsAttention.push({ original, reason: result.reason });
        continue;
      }
      if (seen.has(result.canonical)) {
        duplicatesMerged += 1;
        continue;
      }
      seen.add(result.canonical);
      const entry = { original, result };
      valid.push(entry);
      if (candidate !== result.canonical && candidate !== result.display) {
        fixed.push(entry);
      }
    }
  }

  return { valid, fixed, needsAttention, duplicatesMerged };
}
