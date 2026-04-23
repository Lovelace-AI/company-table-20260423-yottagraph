/**
 * Composable for fetching the latest values of "company table" data points
 * for a resolved organization NEID, plus the date each value was recorded.
 *
 * Data sources (Elemental API / Lovelace Knowledge Graph):
 *  - name, ticker, total_revenue, net_income, total_assets,
 *    total_liabilities, office_count           → properties on the organization
 *  - has_ceo                                   → relationship → person entity name
 *  - headquartered_in / headquarters_address   → relationship → location entity name
 *                                                 (fallback to the formatted address string)
 *  - traded_as                                 → relationship → financial_instrument
 *                                                 → close_price
 *  - appears_in (article)                      → counted within last 24 hours
 *
 * Each cell returns `{ value, date }` so the UI can show
 * "value (YYYY-MM-DD)" per the project brief.
 *
 * IMPORTANT: PIDs and 19-digit relationship targets exceed
 * Number.MAX_SAFE_INTEGER. We parse the schema/property responses through
 * `bigJsonParse` to keep those values as strings — using JS numbers would
 * silently corrupt them and cause empty rows.
 */

import { buildGatewayUrl, gatewayHeaders, padNeid } from '~/utils/elementalHelpers';
import { bigJsonParse } from '~/utils/bigJson';

export interface DataCell<T = string | number | null> {
    value: T;
    date: string | null;
}

export interface CompanyRow {
    neid: string;
    name: DataCell<string>;
    ceo: DataCell<string | null>;
    location: DataCell<string | null>;
    officeCount: DataCell<number | null>;
    ticker: DataCell<string | null>;
    stockPrice: DataCell<number | null>;
    totalRevenue: DataCell<number | null>;
    netIncome: DataCell<number | null>;
    totalAssets: DataCell<number | null>;
    totalLiabilities: DataCell<number | null>;
    newsStories24h: DataCell<number>;
    loading?: boolean;
    error?: string | null;
}

const PROPS = [
    'name',
    'ticker',
    'has_ceo',
    'headquartered_in',
    'headquarters_address',
    'office_count',
    'total_revenue',
    'net_income',
    'total_assets',
    'total_liabilities',
    'traded_as',
    'appears_in',
    'close_price',
] as const;

type PropName = (typeof PROPS)[number];

interface PropValueRow {
    eid: string;
    pid: string;
    value: any;
    recorded_at?: string;
}

let _pidMapPromise: Promise<Map<PropName, string>> | null = null;

async function fetchPidMap(): Promise<Map<PropName, string>> {
    if (_pidMapPromise) return _pidMapPromise;
    _pidMapPromise = (async () => {
        const url = buildGatewayUrl('elemental/metadata/schema');
        const raw = await $fetch<string>(url, {
            headers: { 'X-Api-Key': gatewayHeaders()['X-Api-Key'] },
            responseType: 'text',
        });
        const parsed: any = bigJsonParse(raw);
        const properties: any[] = parsed?.schema?.properties ?? parsed?.properties ?? [];
        const map = new Map<PropName, string>();
        for (const p of properties) {
            const n = p.name as string;
            if ((PROPS as readonly string[]).includes(n)) {
                const id = String(p.pid ?? p.pindex);
                if (id) map.set(n as PropName, id);
            }
        }
        return map;
    })().catch((e) => {
        _pidMapPromise = null;
        throw e;
    });
    return _pidMapPromise;
}

/**
 * Call POST /elemental/entities/properties as form-urlencoded with
 * JSON-stringified `eids` and `pids`, then parse with `bigJsonParse` so
 * 64-bit PIDs and 19-digit relationship target values are preserved.
 */
async function fetchPropertyValues(eids: string[], pids: string[]): Promise<PropValueRow[]> {
    if (!eids.length || !pids.length) return [];
    const url = buildGatewayUrl('elemental/entities/properties');
    const body = new URLSearchParams();
    body.set('eids', JSON.stringify(eids));
    body.set('pids', `[${pids.join(',')}]`);
    const raw = await $fetch<string>(url, {
        method: 'POST',
        headers: {
            'X-Api-Key': gatewayHeaders()['X-Api-Key'],
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        responseType: 'text',
    });
    const parsed: any = bigJsonParse(raw);
    return (parsed?.values ?? []) as PropValueRow[];
}

function pickLatest(values: PropValueRow[]): PropValueRow | null {
    if (!values?.length) return null;
    let best: PropValueRow | null = null;
    let bestT = -Infinity;
    for (const v of values) {
        const t = v.recorded_at ? Date.parse(v.recorded_at) : 0;
        if (t > bestT) {
            bestT = t;
            best = v;
        }
    }
    return best ?? values[0];
}

function emptyCell<T>(): DataCell<T | null> {
    return { value: null as T | null, date: null };
}

function emptyRow(neid: string, name = ''): CompanyRow {
    return {
        neid,
        name: { value: name, date: null },
        ceo: emptyCell<string>(),
        location: emptyCell<string>(),
        officeCount: emptyCell<number>(),
        ticker: emptyCell<string>(),
        stockPrice: emptyCell<number>(),
        totalRevenue: emptyCell<number>(),
        netIncome: emptyCell<number>(),
        totalAssets: emptyCell<number>(),
        totalLiabilities: emptyCell<number>(),
        newsStories24h: { value: 0, date: null },
    };
}

function isoDate(s: string | null | undefined): string | null {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
}

async function resolveFinancialInstrument(ticker: string): Promise<string | null> {
    try {
        const res = await $fetch<any>(buildGatewayUrl('entities/search'), {
            method: 'POST',
            headers: gatewayHeaders(),
            body: {
                queries: [{ queryId: 1, query: ticker, flavors: ['financial_instrument'] }],
                maxResults: 1,
                includeNames: true,
            },
        });
        const m = res?.results?.[0]?.matches?.[0];
        return m ? padNeid(m.neid) : null;
    } catch {
        return null;
    }
}

async function fetchName(neid: string): Promise<string | null> {
    try {
        const res = await $fetch<{ name?: string }>(buildGatewayUrl(`entities/${neid}/name`), {
            headers: { 'X-Api-Key': gatewayHeaders()['X-Api-Key'] },
        });
        return res?.name ?? null;
    } catch {
        return null;
    }
}

export function useCompanyData() {
    /**
     * Search for an organization by name and return the best NEID + canonical name.
     */
    async function resolveOrganization(
        query: string
    ): Promise<{ neid: string; name: string } | null> {
        try {
            const res = await $fetch<any>(buildGatewayUrl('entities/search'), {
                method: 'POST',
                headers: gatewayHeaders(),
                body: {
                    queries: [
                        {
                            queryId: 1,
                            query,
                            flavors: ['organization'],
                        },
                    ],
                    maxResults: 1,
                    includeNames: true,
                },
            });
            const m = res?.results?.[0]?.matches?.[0];
            if (!m) return null;
            return { neid: padNeid(m.neid), name: m.name || query };
        } catch (e) {
            console.error('[useCompanyData] resolveOrganization failed', e);
            return null;
        }
    }

    /**
     * Fetch full property data for a resolved company NEID and assemble a CompanyRow.
     */
    async function loadCompany(neid: string, displayName: string): Promise<CompanyRow> {
        const row = emptyRow(neid, displayName);

        let pidMap: Map<PropName, string>;
        try {
            pidMap = await fetchPidMap();
        } catch (e: any) {
            row.error = e?.message || 'Failed to fetch schema';
            return row;
        }

        const orgPropNames: PropName[] = [
            'name',
            'ticker',
            'has_ceo',
            'headquartered_in',
            'headquarters_address',
            'office_count',
            'total_revenue',
            'net_income',
            'total_assets',
            'total_liabilities',
            'traded_as',
        ];
        const orgPids = orgPropNames.map((n) => pidMap.get(n)).filter((x): x is string => !!x);

        let allValues: PropValueRow[];
        try {
            allValues = await fetchPropertyValues([neid], orgPids);
        } catch (e: any) {
            row.error = e?.message || 'Failed to fetch organization data';
            return row;
        }

        function latestFor(propName: PropName): PropValueRow | null {
            const id = pidMap.get(propName);
            if (!id) return null;
            return pickLatest(allValues.filter((v) => String(v.pid) === id));
        }

        const nameVal = latestFor('name');
        if (nameVal?.value) {
            row.name = { value: String(nameVal.value), date: isoDate(nameVal.recorded_at) };
        }

        const tickerVal = latestFor('ticker');
        if (tickerVal?.value) {
            row.ticker = { value: String(tickerVal.value), date: isoDate(tickerVal.recorded_at) };
        }

        const officeVal = latestFor('office_count');
        if (officeVal?.value !== undefined && officeVal?.value !== null) {
            row.officeCount = {
                value: Number(officeVal.value),
                date: isoDate(officeVal.recorded_at),
            };
        }

        const revVal = latestFor('total_revenue');
        if (revVal?.value !== undefined && revVal?.value !== null) {
            row.totalRevenue = {
                value: Number(revVal.value),
                date: isoDate(revVal.recorded_at),
            };
        }

        const niVal = latestFor('net_income');
        if (niVal?.value !== undefined && niVal?.value !== null) {
            row.netIncome = { value: Number(niVal.value), date: isoDate(niVal.recorded_at) };
        }

        const taVal = latestFor('total_assets');
        if (taVal?.value !== undefined && taVal?.value !== null) {
            row.totalAssets = { value: Number(taVal.value), date: isoDate(taVal.recorded_at) };
        }

        const tlVal = latestFor('total_liabilities');
        if (tlVal?.value !== undefined && tlVal?.value !== null) {
            row.totalLiabilities = {
                value: Number(tlVal.value),
                date: isoDate(tlVal.recorded_at),
            };
        }

        // Location: prefer `headquartered_in` (relationship → location entity)
        // for a clean place name; fall back to the formatted address string.
        const hqInVal = latestFor('headquartered_in');
        if (hqInVal?.value) {
            const locNeid = padNeid(String(hqInVal.value));
            const locName = await fetchName(locNeid);
            row.location = {
                value: locName,
                date: isoDate(hqInVal.recorded_at),
            };
        }
        if (!row.location.value) {
            const hqAddrVal = latestFor('headquarters_address');
            if (hqAddrVal?.value) {
                row.location = {
                    value: String(hqAddrVal.value),
                    date: isoDate(hqAddrVal.recorded_at),
                };
            }
        }

        const ceoVal = latestFor('has_ceo');
        if (ceoVal?.value) {
            const personNeid = padNeid(String(ceoVal.value));
            const personName = await fetchName(personNeid);
            row.ceo = {
                value: personName,
                date: isoDate(ceoVal.recorded_at),
            };
        }

        // Stock price: the `traded_as` relationship is sparsely populated, so
        // we look up the financial_instrument entity by ticker symbol instead,
        // then read its `close_price` property values and take the latest.
        const closePid = pidMap.get('close_price');
        if (row.ticker.value && closePid) {
            try {
                const finNeid = await resolveFinancialInstrument(row.ticker.value);
                if (finNeid) {
                    const finValues = await fetchPropertyValues([finNeid], [closePid]);
                    const latest = pickLatest(finValues.filter((v) => String(v.pid) === closePid));
                    if (latest?.value !== undefined && latest?.value !== null) {
                        row.stockPrice = {
                            value: Number(latest.value),
                            date: isoDate(latest.recorded_at),
                        };
                    }
                }
            } catch {
                // leave stockPrice null
            }
        }

        // News count in last 24 hours from `appears_in` relationship.
        // Requires the org's appears_in PID — note that getPropertyValues
        // returns one row per (article, recording event), so each row counts
        // toward the 24h appearance total when its `recorded_at` is recent.
        const appearsInPid = pidMap.get('appears_in');
        if (appearsInPid) {
            try {
                const appValues = await fetchPropertyValues([neid], [appearsInPid]);
                const cutoff = Date.now() - 24 * 60 * 60 * 1000;
                let count = 0;
                let latestDate: number | null = null;
                const seen = new Set<string>();
                for (const v of appValues) {
                    const t = v.recorded_at ? Date.parse(v.recorded_at) : NaN;
                    if (!isNaN(t) && t >= cutoff) {
                        const key = String(v.value);
                        if (seen.has(key)) continue;
                        seen.add(key);
                        count += 1;
                        if (latestDate === null || t > latestDate) latestDate = t;
                    }
                }
                row.newsStories24h = {
                    value: count,
                    date: latestDate ? new Date(latestDate).toISOString().slice(0, 10) : null,
                };
            } catch {
                // leave count = 0
            }
        }

        return row;
    }

    return {
        resolveOrganization,
        loadCompany,
    };
}
