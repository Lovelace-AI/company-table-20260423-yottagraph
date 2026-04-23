<template>
    <v-autocomplete
        v-model="selected"
        v-model:search="query"
        :items="items"
        :loading="loading"
        :disabled="disabled"
        item-title="name"
        item-value="neid"
        return-object
        hide-no-data
        hide-details
        clearable
        no-filter
        density="comfortable"
        variant="outlined"
        prepend-inner-icon="mdi-magnify"
        label="Add a company"
        placeholder="Type a company name…"
        :menu-props="{ maxHeight: 360 }"
        @update:model-value="onSelect"
    >
        <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" :title="item.raw.name">
                <template #subtitle>
                    <span class="text-caption text-medium-emphasis">
                        organization · {{ item.raw.neid }}
                    </span>
                </template>
            </v-list-item>
        </template>
    </v-autocomplete>
</template>

<script setup lang="ts">
    import { searchEntities } from '~/utils/elementalHelpers';

    const emit = defineEmits<{
        (e: 'select', value: { neid: string; name: string }): void;
    }>();

    defineProps<{ disabled?: boolean }>();

    interface Match {
        neid: string;
        name: string;
    }

    const query = ref('');
    const selected = ref<Match | null>(null);
    const items = ref<Match[]>([]);
    const loading = ref(false);
    let debounceHandle: ReturnType<typeof setTimeout> | null = null;

    watch(query, (q) => {
        if (debounceHandle) clearTimeout(debounceHandle);
        if (!q || q.length < 2) {
            items.value = [];
            return;
        }
        loading.value = true;
        debounceHandle = setTimeout(async () => {
            try {
                const matches = await searchEntities(q, {
                    flavors: ['organization'],
                    maxResults: 10,
                    includeNames: true,
                });
                items.value = matches.map((m) => ({ neid: m.neid, name: m.name }));
            } catch (err) {
                console.warn('[CompanySearchInput] search failed', err);
                items.value = [];
            } finally {
                loading.value = false;
            }
        }, 200);
    });

    function onSelect(val: Match | null) {
        if (!val) return;
        emit('select', { neid: val.neid, name: val.name });
        // Reset so the user can add another company.
        nextTick(() => {
            selected.value = null;
            query.value = '';
            items.value = [];
        });
    }
</script>
