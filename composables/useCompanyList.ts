/**
 * Persisted list of companies (NEIDs + display names) tracked in the table.
 *
 * Stored in KV under the user's per-app preferences. Falls back to in-memory
 * state if KV isn't configured (local dev without Upstash).
 */

import { Pref } from '~/composables/usePrefsStore';

export interface TrackedCompany {
    neid: string;
    name: string;
}

const _companies = ref<TrackedCompany[]>([]);
let _pref: Pref<TrackedCompany[]> | null = null;
let _initialized = false;

export function useCompanyList() {
    async function initialize() {
        if (_initialized) return;
        const { userId } = useUserState();
        const config = useRuntimeConfig();
        const appId = config.public.appId || 'aether-default';
        const uid = userId.value || 'anonymous';

        const docPath = `/users/${uid}/apps/${appId}/companyTable`;
        _pref = new Pref<TrackedCompany[]>(docPath, 'companies', []);
        await _pref.initialize();
        _companies.value = _pref.r.value ?? [];
        _initialized = true;
    }

    function _persist() {
        if (_pref) _pref.set([..._companies.value]);
    }

    function add(c: TrackedCompany) {
        if (_companies.value.some((existing) => existing.neid === c.neid)) {
            return false;
        }
        _companies.value = [..._companies.value, c];
        _persist();
        return true;
    }

    function remove(neid: string) {
        _companies.value = _companies.value.filter((c) => c.neid !== neid);
        _persist();
    }

    function clear() {
        _companies.value = [];
        _persist();
    }

    return {
        companies: readonly(_companies),
        initialize,
        add,
        remove,
        clear,
    };
}
