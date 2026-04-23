import { Pref } from '~/composables/usePrefsStore';

export interface SavedCompany {
    neid: string;
    name: string;
}

let _pref: Pref<SavedCompany[]> | null = null;
let _initialized = false;

/**
 * Persisted list of companies in the table.
 *
 * Stored in KV under the app-scoped path so the list is per-user, per-app.
 * In local dev (no KV credentials) the Pref class silently no-ops writes,
 * which is fine for iteration.
 */
export function useCompanyStore() {
    const { userId } = useUserState();
    const config = useRuntimeConfig();
    const appId = (config.public as any).appId || 'aether';

    if (!_pref) {
        const uid = userId.value || 'anonymous';
        const path = `/users/${uid}/apps/${appId}/features/company-table`;
        _pref = new Pref<SavedCompany[]>(path, 'companies', []);
    }

    async function ensureInitialized() {
        if (_initialized) return;
        await _pref!.initialize();
        _initialized = true;
    }

    async function add(company: SavedCompany) {
        await ensureInitialized();
        const list = [..._pref!.r.value!];
        if (list.some((c) => c.neid === company.neid)) return;
        list.push(company);
        _pref!.set(list);
    }

    async function remove(neid: string) {
        await ensureInitialized();
        const list = (_pref!.r.value || []).filter((c) => c.neid !== neid);
        _pref!.set(list);
    }

    async function clear() {
        await ensureInitialized();
        _pref!.set([]);
    }

    return {
        companies: computed(() => _pref?.r.value ?? []),
        ensureInitialized,
        add,
        remove,
        clear,
    };
}
