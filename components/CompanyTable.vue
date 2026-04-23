<template>
    <v-data-table
        :headers="headers"
        :items="tableItems"
        :loading="loading"
        density="comfortable"
        hover
        fixed-header
        :items-per-page="-1"
        hide-default-footer
        class="company-table"
    >
        <template v-for="col in datedColumns" #[`item.${col}`]="{ item }" :key="col">
            <DatedCell :cell="(item as any)[col]" :format="(item as any)[`${col}Format`]" />
        </template>

        <template #item.newsCount24h="{ item }">
            <span class="font-weight-medium">{{ (item as any).newsCount24h }}</span>
            <span class="text-caption text-medium-emphasis"> (24h)</span>
        </template>

        <template #item.actions="{ item }">
            <v-btn
                icon
                variant="text"
                size="small"
                :title="`Remove ${(item as any).displayName}`"
                @click="emit('remove', (item as any).neid)"
            >
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </template>

        <template #loading>
            <v-skeleton-loader type="table-row@5" />
        </template>

        <template #no-data>
            <div class="pa-8 text-center text-medium-emphasis">
                <v-icon size="48" class="mb-2">mdi-domain-off</v-icon>
                <div>No companies yet. Add one using the search above.</div>
            </div>
        </template>
    </v-data-table>
</template>

<script setup lang="ts">
    import type { CompanyRow, DatedValue } from '~/composables/useCompanyTable';

    const props = defineProps<{
        rows: CompanyRow[];
        loading: boolean;
    }>();

    const emit = defineEmits<{
        (e: 'remove', neid: string): void;
    }>();

    const headers = [
        { title: 'Name', key: 'name', align: 'start' as const, sortable: false, minWidth: 200 },
        { title: 'CEO', key: 'ceo', sortable: false, minWidth: 160 },
        { title: 'Location', key: 'location', sortable: false, minWidth: 220 },
        { title: 'Offices', key: 'officeCount', sortable: false, align: 'end' as const },
        { title: 'Ticker', key: 'ticker', sortable: false },
        { title: 'Stock price', key: 'stockPrice', sortable: false, align: 'end' as const },
        { title: 'Total revenue', key: 'totalRevenue', sortable: false, align: 'end' as const },
        { title: 'Net income', key: 'netIncome', sortable: false, align: 'end' as const },
        { title: 'Total assets', key: 'totalAssets', sortable: false, align: 'end' as const },
        {
            title: 'Total liabilities',
            key: 'totalLiabilities',
            sortable: false,
            align: 'end' as const,
        },
        {
            title: 'News stories',
            key: 'newsCount24h',
            sortable: false,
            align: 'end' as const,
        },
        { title: '', key: 'actions', sortable: false, align: 'end' as const, width: 48 },
    ];

    const datedColumns = [
        'name',
        'ceo',
        'location',
        'officeCount',
        'ticker',
        'stockPrice',
        'totalRevenue',
        'netIncome',
        'totalAssets',
        'totalLiabilities',
    ] as const;

    /** Pre-compute a display format hint per cell so the cell component stays dumb. */
    function usd(n: number): string {
        const abs = Math.abs(n);
        if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
        if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
        if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
        return `$${n.toLocaleString()}`;
    }
    function price(n: number): string {
        return `$${n.toFixed(2)}`;
    }
    function int(n: number): string {
        return n.toLocaleString();
    }

    function fmt<T>(
        cell: DatedValue<T> | null,
        formatter?: (v: T) => string
    ): DatedValue<string> | null {
        if (!cell) return null;
        return {
            value: formatter ? formatter(cell.value) : String(cell.value),
            recordedAt: cell.recordedAt,
        };
    }

    const tableItems = computed(() =>
        props.rows.map((r) => ({
            neid: r.neid,
            displayName: r.name?.value ?? r.neid,
            name: r.name,
            ceo: r.ceo,
            location: r.location,
            officeCount: fmt(r.officeCount as DatedValue<number> | null, int),
            ticker: r.ticker,
            stockPrice: fmt(r.stockPrice as DatedValue<number> | null, price),
            totalRevenue: fmt(r.totalRevenue as DatedValue<number> | null, usd),
            netIncome: fmt(r.netIncome as DatedValue<number> | null, usd),
            totalAssets: fmt(r.totalAssets as DatedValue<number> | null, usd),
            totalLiabilities: fmt(r.totalLiabilities as DatedValue<number> | null, usd),
            newsCount24h: r.newsCount24h,
        }))
    );
</script>

<style scoped>
    .company-table :deep(th) {
        white-space: nowrap;
    }
</style>
