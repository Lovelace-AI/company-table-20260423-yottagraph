<template>
    <div class="company-cell">
        <template v-if="loading">
            <v-progress-circular indeterminate size="14" width="2" color="primary" />
        </template>
        <template v-else-if="value === null || value === undefined || value === ''">
            <span class="empty-mark">—</span>
        </template>
        <template v-else>
            <span :class="['cell-value', { 'cell-mono': mono }]">{{ value }}</span>
            <span v-if="date" class="cell-date">({{ date }})</span>
        </template>
    </div>
</template>

<script setup lang="ts">
    defineProps<{
        value: string | number | null | undefined;
        date?: string | null;
        loading?: boolean;
        mono?: boolean;
    }>();
</script>

<style scoped>
    .company-cell {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: inherit;
    }

    .cell-value {
        font-size: 0.9rem;
    }

    .cell-mono {
        font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
        letter-spacing: 0.02em;
    }

    .cell-date {
        font-size: 0.7rem;
        color: var(--lv-silver, #888);
        font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
        white-space: nowrap;
    }

    .empty-mark {
        color: rgba(255, 255, 255, 0.3);
    }
</style>
