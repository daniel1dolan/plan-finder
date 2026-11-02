import { newPlanId } from '../comparison';
import {
  FIELD_MAX,
  FREQUENCIES,
  MAX_EXPECTED_CARE_COST,
  MAX_PLANS,
  NAME_MAX,
  PAY_FREQUENCIES,
  type Comparison,
  type PlanInput,
} from '../engine/types';

/** v1 is a public contract: links in the wild must keep decoding. Add v2 alongside, never edit v1. */
export const SHARE_VERSION = 1;
const MAX_PAYLOAD = 6000;

const FREQ_BY_CODE = new Map<string, keyof typeof FREQUENCIES>(PAY_FREQUENCIES.map((f) => [FREQUENCIES[f].code, f]));

type V1Plan = [string, string, string, string, string, '' | 'hsa' | 'hra', string];
type V1 = [string, number | null, V1Plan[]];

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

export function encodeComparison(c: Comparison): string {
  const v1: V1 = [
    FREQUENCIES[c.payFrequency].code,
    c.expectedCareCost,
    c.plans.map((p) => [p.name, p.premium, p.deductible, p.coinsurance, p.oopMax, p.contributionType ?? '', p.contribution]),
  ];
  return `${SHARE_VERSION}.${toBase64Url(JSON.stringify(v1))}`;
}

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

function decodeV1(json: unknown): Comparison | null {
  if (!Array.isArray(json) || json.length !== 3) return null;
  const [code, ecc, plans] = json as unknown[];
  const payFrequency = typeof code === 'string' ? FREQ_BY_CODE.get(code) : undefined;
  if (!payFrequency) return null;
  if (ecc !== null && !(typeof ecc === 'number' && Number.isFinite(ecc) && ecc >= 0 && ecc <= MAX_EXPECTED_CARE_COST)) return null;
  if (!Array.isArray(plans) || plans.length < 1 || plans.length > MAX_PLANS) return null;

  const inputs: PlanInput[] = [];
  for (const p of plans) {
    if (!Array.isArray(p) || p.length !== 7) return null;
    const [name, premium, deductible, coinsurance, oopMax, type, contribution] = p as unknown[];
    if (!isStr(name, NAME_MAX)) return null;
    if (![premium, deductible, coinsurance, oopMax, contribution].every((f) => isStr(f, FIELD_MAX))) return null;
    if (type !== '' && type !== 'hsa' && type !== 'hra') return null;
    inputs.push({
      id: newPlanId(),
      name,
      premium: premium as string,
      deductible: deductible as string,
      coinsurance: coinsurance as string,
      oopMax: oopMax as string,
      contributionType: type === '' ? null : type,
      contribution: contribution as string,
    });
  }
  return { plans: inputs, payFrequency, expectedCareCost: ecc };
}

/** Never throws: anything malformed is null. Numeric content is deliberately not validated. */
export function decodeComparison(payload: string): Comparison | null {
  try {
    if (payload.length > MAX_PAYLOAD) return null;
    const m = /^(\d+)\.([A-Za-z0-9_-]+)$/.exec(payload);
    if (!m) return null;
    switch (Number(m[1])) {
      case 1:
        return decodeV1(JSON.parse(fromBase64Url(m[2]!)));
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function payloadFromHash(hash: string): string | null {
  return /^#?c=(.+)$/.exec(hash)?.[1] ?? null;
}

export function shareUrl(c: Comparison, loc: { origin: string; pathname: string }): string {
  return `${loc.origin}${loc.pathname}#c=${encodeComparison(c)}`;
}
