# company-table-20260423

## Vision

This app creates a table of data about organizations from a variety of sources. The user can enter the name of an organization, and the app resolves it to a single entity and adds it to the table. For each value in the table, we use the most recent example we can find, and provide the date of that data in parentheses after the value. The columns of the table are:

- name
- CEO
- location
- office count
- stock ticker
- stock price
- total revenue
- net income
- total assets
- total liabilities
- news stories (24hr) -> this is the count of the number of times this organization appeared in the news in the last day

## Status

MVP built. Single-page app on `/` with a company search and persistent table.

## Implementation notes

Single-page app; no sidebar or tabs. `pages/index.vue` replaces the starter
placeholder and is the only user-facing route.

### Data sources

All data comes from the Lovelace Knowledge Graph via the Portal Gateway
(`/api/qs/{org}/...`). No external APIs are used.

| Column             | Source                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| name               | `name` (pid 8) on the organization entity                                                            |
| CEO                | `has_ceo` (pid 10190322168818861, `data_nindex`) — NEID resolved via `GET /entities/{neid}/name`     |
| location           | `headquarters_address` (pid -3169758313667748639, `data_cat`)                                        |
| office count       | `office_count` (pid 344, `data_float`) — sparse outside FDIC banks; cell shows `—` when missing      |
| stock ticker       | `ticker` (pid 169) on the organization entity                                                        |
| stock price        | `last_trade_price` / `close_price` on the **financial_instrument** entity (looked up by name)        |
| total revenue      | `total_revenue` (pid 181, `data_int`)                                                                |
| net income         | `net_income` (pid 182, `data_int`)                                                                   |
| total assets       | `total_assets` (pid 183, `data_int`)                                                                 |
| total liabilities  | `total_liabilities` (pid 184, `data_int`)                                                            |
| news stories (24h) | count of `appears_in` (pid 113) edge rows on the org whose `recorded_at` is within the last 24 hours |

Every property response is reduced to its single most-recent value using
`recorded_at`. The cell renders `<value> (YYYY-MM-DD)` using that timestamp.

### Architecture

- `composables/useCompanyStore.ts` — `Pref<SavedCompany[]>` persisted under
  `/users/{userId}/apps/{appId}/features/company-table/companies`. Survives
  refresh in deployed builds where KV is configured; no-ops silently in
  local dev.
- `composables/useCompanyTable.ts` — fetches all properties in a single
  `POST /elemental/entities/properties` call per company, resolves the
  CEO nindex to a display name, and does a separate
  `POST /entities/search` with `flavors: ["financial_instrument"]` to
  get the stock price. 64-bit PIDs are emitted as unquoted JSON tokens
  (never round-tripped through JS `Number`) per the Aether data gotcha
  list.
- `components/CompanySearchInput.vue` — debounced autocomplete against
  `POST /entities/search` filtered to `organization`.
- `components/CompanyTable.vue` — Vuetify `v-data-table` wrapper that
  formats currency columns (revenue/income/assets/liabilities) with
  `$1.23B`-style suffixes.
- `components/DatedCell.vue` — shared cell renderer that appends
  `(YYYY-MM-DD)` from `recorded_at`.
- `pages/index.vue` — single page that wires search, store, and table
  together.

### Known limits

- "News stories (24h)" is derived from the recorded_at on the
  `appears_in` edges rather than a dedicated article publication date,
  because the `date` property on articles is a `data_cat` string and
  `lt`/`gt` only work on numeric properties. This is a reasonable proxy
  (the ingestion timestamp of the mention) but is not strictly the
  article's publish time.
- Stock price uses the first `financial_instrument` whose name matches
  the organization's name. For tickers with multiple listings this
  picks the top-scored match.

## Modules

- `pages/index.vue`
- `components/CompanySearchInput.vue`
- `components/CompanyTable.vue`
- `components/DatedCell.vue`
- `composables/useCompanyStore.ts`
- `composables/useCompanyTable.ts`
