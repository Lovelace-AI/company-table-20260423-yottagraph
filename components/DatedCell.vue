<template>
    <template v-if="cell">
        <span>{{ cell.value }}</span>
        <span v-if="dateLabel" class="text-caption text-medium-emphasis ml-1">
            ({{ dateLabel }})
        </span>
    </template>
    <span v-else class="text-disabled">—</span>
</template>

<script setup lang="ts">
    import type { DatedValue } from '~/composables/useCompanyTable';

    const props = defineProps<{
        cell: DatedValue<string> | null;
    }>();

    const dateLabel = computed(() => {
        const ts = props.cell?.recordedAt;
        if (!ts) return '';
        // Render the recorded_at as YYYY-MM-DD; that is all we need for the
        // "(date)" suffix called out in DESIGN.md.
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    });
</script>
