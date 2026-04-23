/**
 * JSON parser that preserves precision for 64-bit integer fields that
 * exceed `Number.MAX_SAFE_INTEGER` (2^53 - 1).
 *
 * The Lovelace knowledge graph uses 64-bit integers for some PIDs, FIDs,
 * and entity IDs. A vanilla `JSON.parse` silently rounds those values
 * (e.g. `10190322168818861` → `10190322168818860`), causing downstream
 * lookups against those IDs to fail with no error.
 *
 * This helper rewrites long-integer JSON literals for known fields into
 * quoted strings before parsing, so callers can keep the original digits.
 *
 * Only fields whose names are listed in `STRINGIFY_FIELDS` are rewritten.
 * Everything else is parsed normally.
 */

const STRINGIFY_FIELDS = ['pid', 'pindex', 'fid', 'findex', 'value', 'eid', 'entity_id'];

const FIELDS_RE = STRINGIFY_FIELDS.join('|');

// Match: optional whitespace, "field":, optional whitespace, an integer of 16+ digits
// (16 covers everything > 10^15, and Number.MAX_SAFE_INTEGER is 16 digits long).
const LONG_INT_RE = new RegExp(`("(?:${FIELDS_RE})")\\s*:\\s*(-?\\d{16,})(?=\\s*[,}\\]])`, 'g');

export function bigJsonParse<T = any>(raw: string): T {
    const safe = raw.replace(LONG_INT_RE, '$1:"$2"');
    return JSON.parse(safe) as T;
}
