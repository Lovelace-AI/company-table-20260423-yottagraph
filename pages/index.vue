<template>
    <div class="d-flex flex-column fill-height">
        <div class="flex-shrink-0 pa-6 page-header">
            <div class="d-flex align-center mb-1">
                <v-icon class="mr-2" color="primary">mdi-table-large</v-icon>
                <h1 class="text-h5 font-weight-medium">Company table</h1>
                <v-spacer />
                <v-btn
                    variant="text"
                    size="small"
                    :loading="loading"
                    :disabled="!companies.length"
                    prepend-icon="mdi-refresh"
                    @click="refresh"
                >
                    Refresh
                </v-btn>
            </div>
            <div class="text-body-2 text-medium-emphasis mb-4">
                Search for a company to add it to the table. Each cell shows the most recent value
                from the Lovelace Knowledge Graph; the date in parentheses is when that value was
                recorded.
            </div>
            <div class="search-wrap">
                <CompanySearchInput :disabled="loading" @select="onSelect" />
            </div>
            <v-alert
                v-if="error"
                type="error"
                variant="tonal"
                class="mt-3"
                closable
                @click:close="error = null"
            >
                {{ error }}
            </v-alert>
        </div>

        <div class="flex-grow-1 overflow-y-auto pa-6 pt-0">
            <CompanyTable :rows="rows" :loading="loading" @remove="onRemove" />
        </div>
    </div>
</template>

<script setup lang="ts">
    const store = useCompanyStore();
    const { rows, loading, error, load } = useCompanyTable();

    const companies = computed(() => store.companies.value);

    async function refresh() {
        await load(companies.value.map((c) => ({ neid: c.neid, name: c.name })));
    }

    async function onSelect(entity: { neid: string; name: string }) {
        await store.add(entity);
        await refresh();
    }

    async function onRemove(neid: string) {
        await store.remove(neid);
        await refresh();
    }

    onMounted(async () => {
        await store.ensureInitialized();
        if (companies.value.length) {
            await refresh();
        }
    });
</script>

<style scoped>
    .page-header {
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .search-wrap {
        max-width: 560px;
    }
</style>
