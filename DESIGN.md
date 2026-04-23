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

Initial scaffold built (2026-04-23). The home page renders the company
table described in the Vision; users can search for any organization
indexed by Lovelace and add it as a row. Each row is hydrated with the
most recent values for CEO, location, office count, ticker, stock price,
revenue, net income, total assets, total liabilities, and 24-hour news
mentions, with the source date in parentheses.

Persistence: the list of tracked companies is stored as a `Pref` in the
per-user / per-app KV namespace, so refreshing the page restores the
table when KV is configured.

## Modules

- `pages/index.vue` — full-page company table (search bar + Vuetify
  `v-table`).
- `components/CompanySearch.vue` — debounced type-ahead that calls the
  Elemental `entities/search` endpoint scoped to `organization` flavor.
- `components/CompanyCell.vue` — renders one cell with value plus the
  date in parentheses (or a loading spinner / em-dash when missing).
- `composables/useCompanyData.ts` — given an organization NEID, fetches
  scalar properties via `client.getPropertyValues`, follows
  `has_ceo` / `headquartered_in` / `traded_as` relationships to look up
  display names and the latest `close_price` on the linked
  `financial_instrument`, and counts `appears_in` article links recorded
  in the last 24 hours.
- `composables/useCompanyList.ts` — wraps a `Pref<TrackedCompany[]>` so
  the visible list survives reloads when KV is configured.
