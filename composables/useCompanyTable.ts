import {
    buildGatewayUrl,
    gatewayHeaders,
    getApiKey,
    getEntityName,
    padNeid,
    searchEntities,
} from '~/utils/elementalHelpers';

/**
 * Property IDs used by the company table.
 *
 * These are stable in the current Lovelace schema. If the schema evolves,
 * swap to dynamic lookup via `useElementalSchema().pidByName()`.
 */
export const COMPANY_PIDS = {
    name: 8,
    ticker: 169,
    has_ceo: '10190322168818861',
    headquarters_address: '-3169758313667748639',
    office_count: 344,
    total_revenue: 181,
    net_income: 182,
    total_assets: 183,
    total_liabilities: 184,
    appears_in: 113,
    last_trade_price: '2208445518693774690',
    close_price: '7627506139678298689',
} as const;

/** A single cell: the most recent value and its recorded date. */
export interface DatedValue<T = string | number> {
    value: T;
    recordedAt: string; // ISO timestamp
}

export interface CompanyRow {
    neid: string;
    name: DatedValue<string> | null;
    ceo: DatedValue<string> | null;
    location: DatedValue<string> | null;
    officeCount: DatedValue<number> | null;
    ticker: DatedValue<string> | null;
    stockPrice: DatedValue<number> | null;
    totalRevenue: DatedValue<number> | null;
    netIncome: DatedValue<number> | null;
    totalAssets: DatedValue<number> | null;
    totalLiabilities: DatedValue<number> | null;
    newsCount24h: number;
    loading: boolean;
    error?: string;
}

interface PropertyValueRow {
    eid: string;
    pid: number | string;
    value: any;
    recorded_at: string;
}

interface PropertiesResponse {
    values?: PropertyValueRow[];
}

/**
 * Fetch raw property values for a set of entities / PIDs.
 *
 * `/elemental/entities/properties` requires form-encoded body with JSON
 * stringified arrays. PIDs are sent as strings (see data.md — large 64-bit
 * IDs lose precision if round-tripped through Number).
 */
async function fetchProperties(
    eids: string[],
    pids: (number | string)[]
): Promise<PropertyValueRow[]> {
    if (!eids.length || !pids.length) return [];
    const url = buildGatewayUrl('elemental/entities/properties');
    const body = new URLSearchParams();
    body.set('eids', JSON.stringify(eids));
    // Build the PIDs array manually so 64-bit IDs stay as JSON numbers
    // without going through JS Number. PID strings like "10190322168818861"
    // are emitted unquoted; small ones pass through unchanged.
    const pidArr = `[${pids.map((p) => String(p)).join(',')}]`;
    body.set('pids', pidArr);

    const res = await $fetch<PropertiesResponse>(url, {
        method: 'POST',
        headers: {
            'X-Api-Key': getApiKey(),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });
    return res?.values ?? [];
}

/** Keep only the single most recent row per PID. */
function latestByPid(rows: PropertyValueRow[]): Map<string, PropertyValueRow> {
    const out = new Map<string, PropertyValueRow>();
    for (const r of rows) {
        const key = String(r.pid);
        const prev = out.get(key);
        if (!prev || (r.recorded_at ?? '') > (prev.recorded_at ?? '')) {
            out.set(key, r);
        }
    }
    return out;
}

function toDatedString(row?: PropertyValueRow): DatedValue<string> | null {
    if (!row || row.value == null) return null;
    return { value: String(row.value), recordedAt: row.recorded_at };
}

function toDatedNumber(row?: PropertyValueRow): DatedValue<number> | null {
    if (!row || row.value == null) return null;
    const n = typeof row.value === 'number' ? row.value : Number(row.value);
    if (!Number.isFinite(n)) return null;
    return { value: n, recordedAt: row.recorded_at };
}

/** Count "appears_in" edge values on the org whose recorded_at is within 24h. */
function countRecent(rows: PropertyValueRow[], windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    let n = 0;
    for (const r of rows) {
        const t = Date.parse(r.recorded_at || '');
        if (!Number.isNaN(t) && t >= cutoff) n += 1;
    }
    return n;
}

/**
 * Fetch a financial_instrument matching the org name and return its most
 * recent stock price. Uses last_trade_price, then close_price as fallback.
 */
async function fetchStockPrice(orgName: string): Promise<DatedValue<number> | null> {
    try {
        const matches = await searchEntities(orgName, {
            flavors: ['financial_instrument'],
            maxResults: 1,
        });
        if (!matches.length) return null;
        const fiNeid = padNeid(matches[0].neid);
        const rows = await fetchProperties(
            [fiNeid],
            [COMPANY_PIDS.last_trade_price, COMPANY_PIDS.close_price]
        );
        const latest = latestByPid(rows);
        return (
            toDatedNumber(latest.get(String(COMPANY_PIDS.last_trade_price))) ??
            toDatedNumber(latest.get(String(COMPANY_PIDS.close_price)))
        );
    } catch (err) {
        console.warn('[useCompanyTable] stock price fetch failed', err);
        return null;
    }
}

/** Build a fully populated CompanyRow for a single org NEID. */
async function fetchCompanyRow(neid: string, fallbackName: string): Promise<CompanyRow> {
    const row: CompanyRow = {
        neid,
        name: null,
        ceo: null,
        location: null,
        officeCount: null,
        ticker: null,
        stockPrice: null,
        totalRevenue: null,
        netIncome: null,
        totalAssets: null,
        totalLiabilities: null,
        newsCount24h: 0,
        loading: false,
    };

    try {
        const allRows = await fetchProperties(
            [neid],
            [
                COMPANY_PIDS.name,
                COMPANY_PIDS.ticker,
                COMPANY_PIDS.has_ceo,
                COMPANY_PIDS.headquarters_address,
                COMPANY_PIDS.office_count,
                COMPANY_PIDS.total_revenue,
                COMPANY_PIDS.net_income,
                COMPANY_PIDS.total_assets,
                COMPANY_PIDS.total_liabilities,
                COMPANY_PIDS.appears_in,
            ]
        );

        const byPid = new Map<string, PropertyValueRow[]>();
        for (const r of allRows) {
            const k = String(r.pid);
            if (!byPid.has(k)) byPid.set(k, []);
            byPid.get(k)!.push(r);
        }
        const latest = latestByPid(allRows);

        row.name = toDatedString(latest.get(String(COMPANY_PIDS.name)));
        row.ticker = toDatedString(latest.get(String(COMPANY_PIDS.ticker)));
        row.location = toDatedString(latest.get(String(COMPANY_PIDS.headquarters_address)));
        row.officeCount = toDatedNumber(latest.get(String(COMPANY_PIDS.office_count)));
        row.totalRevenue = toDatedNumber(latest.get(String(COMPANY_PIDS.total_revenue)));
        row.netIncome = toDatedNumber(latest.get(String(COMPANY_PIDS.net_income)));
        row.totalAssets = toDatedNumber(latest.get(String(COMPANY_PIDS.total_assets)));
        row.totalLiabilities = toDatedNumber(latest.get(String(COMPANY_PIDS.total_liabilities)));

        // News count = number of `appears_in` edges recorded in last 24h.
        // Each row in byPid[appears_in] is one article->org edge.
        row.newsCount24h = countRecent(
            byPid.get(String(COMPANY_PIDS.appears_in)) ?? [],
            24 * 3600 * 1000
        );

        // CEO is a relationship (data_nindex) — resolve the linked entity's name.
        const ceoRow = latest.get(String(COMPANY_PIDS.has_ceo));
        if (ceoRow?.value != null) {
            try {
                const ceoNeid = padNeid(ceoRow.value);
                const name = await getEntityName(ceoNeid);
                row.ceo = { value: name, recordedAt: ceoRow.recorded_at };
            } catch {
                /* leave ceo null */
            }
        }

        // Stock price is on the financial_instrument, not the org.
        const nameForFiLookup = row.name?.value || fallbackName;
        if (nameForFiLookup) {
            row.stockPrice = await fetchStockPrice(nameForFiLookup);
        }
    } catch (err: any) {
        row.error = err?.message || String(err);
    }

    return row;
}

export function useCompanyTable() {
    const rows = ref<CompanyRow[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    /** Refetch all rows for the given NEIDs in parallel. */
    async function load(targets: { neid: string; name: string }[]) {
        if (!targets.length) {
            rows.value = [];
            return;
        }
        loading.value = true;
        error.value = null;
        try {
            // Initialize placeholder rows so the table renders immediately.
            rows.value = targets.map((t) => ({
                neid: t.neid,
                name: { value: t.name, recordedAt: '' },
                ceo: null,
                location: null,
                officeCount: null,
                ticker: null,
                stockPrice: null,
                totalRevenue: null,
                netIncome: null,
                totalAssets: null,
                totalLiabilities: null,
                newsCount24h: 0,
                loading: true,
            }));

            const results = await Promise.all(
                targets.map((t) =>
                    fetchCompanyRow(t.neid, t.name).then((r) => ({ ...r, loading: false }))
                )
            );
            // Preserve original order.
            const byNeid = new Map(results.map((r) => [r.neid, r]));
            rows.value = targets.map((t) => byNeid.get(t.neid)!).filter(Boolean);
        } catch (err: any) {
            error.value = err?.message || String(err);
        } finally {
            loading.value = false;
        }
    }

    return {
        rows,
        loading,
        error,
        load,
    };
}
