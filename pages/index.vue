<template>
    <div class="company-table-page">
        <div class="page-header">
            <div>
                <h1 class="page-title">Company Table</h1>
                <p class="page-subtitle">
                    Track key facts across organizations from the Lovelace knowledge graph. Each
                    value is the most recent we have on file; the date when it was recorded appears
                    in parentheses.
                </p>
            </div>
        </div>

        <div class="search-bar">
            <CompanySearch @selected="onAddCompany" />
            <v-btn
                v-if="companies.length > 0"
                variant="text"
                color="error"
                size="small"
                prepend-icon="mdi-trash-can-outline"
                @click="onClearAll"
            >
                Clear all
            </v-btn>
        </div>

        <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            class="mb-3"
            closable
            @click:close="errorMessage = ''"
        >
            {{ errorMessage }}
        </v-alert>

        <div v-if="companies.length === 0" class="empty-state-wrap">
            <v-empty-state
                headline="No companies yet"
                title="Add a company to get started"
                text="Search for any organization above (e.g. Microsoft, Apple, JPMorgan) to add it to your table."
                icon="mdi-domain-plus"
            />
        </div>

        <div v-else class="table-wrap">
            <v-table density="comfortable" hover class="company-table">
                <thead>
                    <tr>
                        <th class="col-actions"></th>
                        <th>Name</th>
                        <th>CEO</th>
                        <th>Location</th>
                        <th class="text-right">Office count</th>
                        <th>Stock ticker</th>
                        <th class="text-right">Stock price</th>
                        <th class="text-right">Total revenue</th>
                        <th class="text-right">Net income</th>
                        <th class="text-right">Total assets</th>
                        <th class="text-right">Total liabilities</th>
                        <th class="text-right">News stories (24h)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in rows" :key="row.neid">
                        <td class="col-actions">
                            <v-btn
                                icon="mdi-close"
                                size="x-small"
                                variant="text"
                                @click="onRemove(row.neid)"
                            />
                        </td>
                        <td>
                            <div class="cell-primary">
                                {{ row.name.value || row.neid }}
                            </div>
                        </td>
                        <td>
                            <CompanyCell
                                :loading="row.loading"
                                :value="row.ceo.value"
                                :date="row.ceo.date"
                            />
                        </td>
                        <td>
                            <CompanyCell
                                :loading="row.loading"
                                :value="row.location.value"
                                :date="row.location.date"
                            />
                        </td>
                        <td class="text-right">
                            <CompanyCell
                                :loading="row.loading"
                                :value="formatNumber(row.officeCount.value)"
                                :date="row.officeCount.date"
                            />
                        </td>
                        <td>
                            <CompanyCell
                                :loading="row.loading"
                                :value="row.ticker.value"
                                :date="row.ticker.date"
                                mono
                            />
                        </td>
                        <td class="text-right">
                            <CompanyCell
                                :loading="row.loading"
                                :value="formatCurrency(row.stockPrice.value, 2)"
                                :date="row.stockPrice.date"
                            />
                        </td>
                        <td class="text-right">
                            <CompanyCell
                                :loading="row.loading"
                                :value="formatBigCurrency(row.totalRevenue.value)"
                                :date="row.totalRevenue.date"
                            />
                        </td>
                        <td class="text-right">
                            <CompanyCell
                                :loading="row.loading"
                                :value="formatBigCurrency(row.netIncome.value)"
                                :date="row.netIncome.date"
                            />
                        </td>
                        <td class="text-right">
                            <CompanyCell
                                :loading="row.loading"
                                :value="formatBigCurrency(row.totalAssets.value)"
                                :date="row.totalAssets.date"
                            />
                        </td>
                        <td class="text-right">
                            <CompanyCell
                                :loading="row.loading"
                                :value="formatBigCurrency(row.totalLiabilities.value)"
                                :date="row.totalLiabilities.date"
                            />
                        </td>
                        <td class="text-right">
                            <CompanyCell
                                :loading="row.loading"
                                :value="formatNumber(row.newsStories24h.value)"
                                :date="row.newsStories24h.date"
                            />
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </div>
    </div>
</template>

<script setup lang="ts">
    import type { CompanyRow } from '~/composables/useCompanyData';

    const { companies, initialize, add, remove, clear } = useCompanyList();
    const { resolveOrganization, loadCompany } = useCompanyData();

    const errorMessage = ref('');
    const rowMap = reactive(new Map<string, CompanyRow>());

    const rows = computed<CompanyRow[]>(() => {
        return companies.value.map(
            (c) =>
                rowMap.get(c.neid) ?? {
                    ...emptyRowFor(c.neid, c.name),
                    loading: true,
                }
        );
    });

    function emptyRowFor(neid: string, name: string): CompanyRow {
        return {
            neid,
            name: { value: name, date: null },
            ceo: { value: null, date: null },
            location: { value: null, date: null },
            officeCount: { value: null, date: null },
            ticker: { value: null, date: null },
            stockPrice: { value: null, date: null },
            totalRevenue: { value: null, date: null },
            netIncome: { value: null, date: null },
            totalAssets: { value: null, date: null },
            totalLiabilities: { value: null, date: null },
            newsStories24h: { value: 0, date: null },
            loading: true,
        };
    }

    async function refreshRow(neid: string, name: string) {
        rowMap.set(neid, { ...emptyRowFor(neid, name), loading: true });
        try {
            const data = await loadCompany(neid, name);
            rowMap.set(neid, { ...data, loading: false });
        } catch (e: any) {
            rowMap.set(neid, {
                ...emptyRowFor(neid, name),
                loading: false,
                error: e?.message || 'Failed to load',
            });
        }
    }

    onMounted(async () => {
        await initialize();
        for (const c of companies.value) {
            refreshRow(c.neid, c.name);
        }
    });

    async function onAddCompany(entity: { neid: string; name: string }) {
        errorMessage.value = '';
        // Re-resolve via /entities/search to get the canonical org name + a stable NEID,
        // since type-ahead may surface alternative spellings.
        const resolved = await resolveOrganization(entity.name);
        const finalEntity = resolved ?? entity;
        const inserted = add(finalEntity);
        if (!inserted) {
            errorMessage.value = `${finalEntity.name} is already in the table.`;
            return;
        }
        refreshRow(finalEntity.neid, finalEntity.name);
    }

    function onRemove(neid: string) {
        remove(neid);
        rowMap.delete(neid);
    }

    function onClearAll() {
        clear();
        rowMap.clear();
    }

    function formatNumber(n: number | null): string | null {
        if (n === null || n === undefined || isNaN(n)) return null;
        return new Intl.NumberFormat('en-US').format(n);
    }

    function formatCurrency(n: number | null, decimals = 0): string | null {
        if (n === null || n === undefined || isNaN(n)) return null;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(n);
    }

    function formatBigCurrency(n: number | null): string | null {
        if (n === null || n === undefined || isNaN(n)) return null;
        const abs = Math.abs(n);
        if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
        if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
        if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
        if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
        return formatCurrency(n);
    }
</script>

<style scoped>
    .company-table-page {
        height: 100%;
        overflow-y: auto;
        padding: 24px 32px;
    }

    .page-header {
        margin-bottom: 16px;
    }

    .page-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.75rem;
        letter-spacing: 0.02em;
        margin-bottom: 4px;
    }

    .page-subtitle {
        color: var(--lv-silver, #b4b4b4);
        font-size: 0.9rem;
        max-width: 760px;
        line-height: 1.4;
    }

    .search-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 16px 0 24px;
    }

    .empty-state-wrap {
        margin-top: 48px;
    }

    .table-wrap {
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        overflow: hidden;
        background: var(--lv-surface, #141414);
    }

    .company-table {
        background: transparent !important;
    }

    .company-table :deep(thead th) {
        font-family: var(--font-headline);
        font-weight: 500;
        font-size: 0.75rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--lv-silver, #b4b4b4);
        white-space: nowrap;
    }

    .company-table :deep(tbody td) {
        vertical-align: top;
        padding-top: 10px;
        padding-bottom: 10px;
    }

    .col-actions {
        width: 36px;
        padding-right: 0 !important;
    }

    .cell-primary {
        font-weight: 500;
        font-size: 0.95rem;
    }

    .text-right {
        text-align: right;
    }
</style>
