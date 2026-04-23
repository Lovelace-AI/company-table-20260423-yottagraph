<template>
    <div class="company-search">
        <v-text-field
            v-model="searchQuery"
            label="Add a company"
            placeholder="Type a company name and press Enter…"
            prepend-inner-icon="mdi-domain"
            variant="solo-filled"
            rounded="lg"
            clearable
            density="comfortable"
            hide-details
            :loading="searching"
            @focus="showMenu = suggestions.length > 0"
            @keydown.enter.prevent="onEnter"
            @click:clear="onClear"
        />

        <v-card v-if="showMenu && suggestions.length > 0" class="search-dropdown" elevation="8">
            <v-list density="compact">
                <v-list-item
                    v-for="item in suggestions"
                    :key="item.neid"
                    :title="item.name"
                    :subtitle="`NEID ${item.neid}`"
                    @click="onSelect(item)"
                />
            </v-list>
        </v-card>
    </div>
</template>

<script setup lang="ts">
    import { padNeid, searchEntities } from '~/utils/elementalHelpers';

    const emit = defineEmits<{
        selected: [entity: { neid: string; name: string }];
    }>();

    const searchQuery = ref('');
    const suggestions = ref<{ neid: string; name: string }[]>([]);
    const searching = ref(false);
    const showMenu = ref(false);
    let selectedName = '';
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    watch(searchQuery, (val) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        if (val === selectedName) return;
        if (!val || val.length < 2) {
            suggestions.value = [];
            showMenu.value = false;
            return;
        }
        debounceTimer = setTimeout(() => doSearch(val), 250);
    });

    async function doSearch(query: string) {
        searching.value = true;
        try {
            const results = await searchEntities(query, {
                maxResults: 8,
                flavors: ['organization'],
            });
            suggestions.value = results.map((r) => ({
                neid: padNeid(r.neid),
                name: r.name,
            }));
            showMenu.value = suggestions.value.length > 0;
        } catch (e) {
            console.error('[CompanySearch] search failed', e);
            suggestions.value = [];
            showMenu.value = false;
        } finally {
            searching.value = false;
        }
    }

    function onSelect(item: { neid: string; name: string }) {
        selectedName = item.name;
        searchQuery.value = '';
        suggestions.value = [];
        showMenu.value = false;
        emit('selected', item);
        nextTick(() => {
            selectedName = '';
        });
    }

    function onEnter() {
        if (suggestions.value.length > 0) {
            onSelect(suggestions.value[0]);
        }
    }

    function onClear() {
        selectedName = '';
        suggestions.value = [];
        showMenu.value = false;
    }

    onMounted(() => {
        const handler = (e: MouseEvent) => {
            const el = (e.target as HTMLElement)?.closest('.company-search');
            if (!el) showMenu.value = false;
        };
        document.addEventListener('click', handler);
        onBeforeUnmount(() => document.removeEventListener('click', handler));
    });
</script>

<style scoped>
    .company-search {
        position: relative;
        max-width: 480px;
        width: 100%;
    }

    .search-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 100;
        max-height: 320px;
        overflow-y: auto;
        margin-top: 4px;
    }
</style>
