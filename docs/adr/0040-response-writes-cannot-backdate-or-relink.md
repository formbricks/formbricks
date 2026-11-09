# v3 response writes cannot backdate, carry contact attributes or re-link a contact

v3 deliberately accepts less than v2 management in three places (ENG-2868). `createdAt` and `updatedAt` are server-owned: a client-set `createdAt` lets a caller dodge monthly response metering, which counts by `createdAt`, and slip rows into the middle of another consumer's paginated stream. `contactAttributes` is not on the resource, because it is a stale copy of the contact's attributes (read them off the contact). The contact is linked by `contactId` on create only, never by `userId` and never re-linked by PATCH: re-pointing a response at another contact is the ENG-1923 shape, and `userId` is an attribute lookup that can match more than one contact. Server-derived fields stay server-derived whatever the key can do: `meta` is narrowed to `source`, `url` and `action`, so `ipAddress`, `country` and `userAgent` can't be forged.

## Consequences

- Importing history with its original dates still needs v2 until an import path exists. That gap is why v1/v2 response endpoints carry no `Deprecation` header yet (ENG-2066): deprecating them would push importers to an API that can't serve them.
- Each rejected field sits on the deny-list in `apps/web/app/api/v3/responses/lib/reference-manifest.ts`, so adding one back is a visible decision.
- `ttc` is accepted and clamped to [0, 24h] (v1's rule), so API-created responses still carry timings.
