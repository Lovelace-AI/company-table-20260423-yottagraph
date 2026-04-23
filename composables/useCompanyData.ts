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
 */

import { useElementalClient } from '@yottagraph-app/elemental-api/client';

import { buildGatewayUrl, gatewayHeaders, padNeid } from '~/utils/elementalHelpers';

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
] as const;

type PropName = (typeof PROPS)[number];

interface PropValueRow {
    eid: string;
    pid: number;
    value: any;
    recorded_at?: string;
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

/**
 * Resolve a single PID by property name from a runtime PID map.
 */
function pid(map: Map<string, number>, name: PropName): number | null {
    return map.get(name) ?? null;
}

/**
 * Fetch the canonical display name for an entity by NEID.
 * Tolerates 404s (returns null) since some NEIDs aren't resolvable.
 */
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
    const client = useElementalClient();
    const { refresh: refreshSchema, pidByName } = useElementalSchema();

    /**
     * Build the {name → pid} map for the properties we care about.
     */
    async function getPidMap(): Promise<Map<string, number>> {
        await refreshSchema();
        const out = new Map<string, number>();
        for (const p of PROPS) {
            const id = pidByName(p);
            if (id !== null) out.set(p, id as number);
        }
        return out;
    }

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

        const pidMap = await getPidMap();
        const orgPids = (
            [
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
            ] as PropName[]
        )
            .map((n) => pidMap.get(n))
            .filter((x): x is number => x !== undefined);

        let propsRes: any;
        try {
            propsRes = await client.getPropertyValues({
                eids: JSON.stringify([neid]),
                pids: JSON.stringify(orgPids),
            } as any);
        } catch (e: any) {
            row.error = e?.message || 'Failed to fetch organization data';
            return row;
        }

        const allValues: PropValueRow[] = (propsRes?.values ?? []) as PropValueRow[];

        function latestFor(propName: PropName): PropValueRow | null {
            const id = pid(pidMap, propName);
            if (id === null) return null;
            return pickLatest(allValues.filter((v) => v.pid === id));
        }

        // Simple scalar properties
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
            row.totalRevenue = { value: Number(revVal.value), date: isoDate(revVal.recorded_at) };
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

        // Location: prefer headquartered_in (relationship → location entity) for the
        // human-readable name; fall back to headquarters_address (formatted string).
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

        // CEO: has_ceo (relationship → person entity)
        const ceoVal = latestFor('has_ceo');
        if (ceoVal?.value) {
            const personNeid = padNeid(String(ceoVal.value));
            const personName = await fetchName(personNeid);
            row.ceo = {
                value: personName,
                date: isoDate(ceoVal.recorded_at),
            };
        }

        // Stock price: traded_as (relationship → financial_instrument) → close_price
        const tradedAsVal = latestFor('traded_as');
        if (tradedAsVal?.value) {
            const finNeid = padNeid(String(tradedAsVal.value));
            const closePid = pidMap.get('name'); // placeholder, replaced below
            const closePriceId = pidByName('close_price');
            if (closePriceId !== null) {
                try {
                    const finRes: any = await client.getPropertyValues({
                        eids: JSON.stringify([finNeid]),
                        pids: JSON.stringify([closePriceId]),
                    } as any);
                    const finValues: PropValueRow[] = finRes?.values ?? [];
                    const latest = pickLatest(finValues.filter((v) => v.pid === closePriceId));
                    if (latest?.value !== undefined && latest?.value !== null) {
                        row.stockPrice = {
                            value: Number(latest.value),
                            date: isoDate(latest.recorded_at),
                        };
                    }
                } catch {
                    // leave stockPrice null
                }
            }
            void closePid;
        }

        // News count in last 24 hours from `appears_in` relationship
        const appearsInPid = pid(pidMap, 'appears_in');
        if (appearsInPid !== null) {
            try {
                const appRes: any = await client.getPropertyValues({
                    eids: JSON.stringify([neid]),
                    pids: JSON.stringify([appearsInPid]),
                } as any);
                const appValues: PropValueRow[] = appRes?.values ?? [];
                const cutoff = Date.now() - 24 * 60 * 60 * 1000;
                let count = 0;
                let latestDate: number | null = null;
                for (const v of appValues) {
                    const t = v.recorded_at ? Date.parse(v.recorded_at) : NaN;
                    if (!isNaN(t) && t >= cutoff) {
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
