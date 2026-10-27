# Count impressions and clicks with counters, not event rows

The SDK batches a page view's Impressions and Clicks into one events request (ENG-3912, ENG-3919). The server increments Redis counters in one Lua call, and a BullMQ job writes daily totals (`CreativeDailyStat`, keyed by creative, UTC day and device type) and per-page totals (`CreativeDailyPageStat`, host + path, capped at 1000 pages a day). The flush is idempotent: Redis keeps per-day totals for about 48 h and the job writes `GREATEST(db, redis)`. A row per event would be about 1 B rows a year.

## Consequences

- A breakdown added later can't be backfilled, which is why device type is on the daily totals from day one.
- Without a BullMQ worker, counts never reach Postgres; the self-hosting job runner docs say so.
