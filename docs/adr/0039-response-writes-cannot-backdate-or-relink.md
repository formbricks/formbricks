# v3 response writes cannot backdate, carry contact attributes or re-link a contact

v3 accepts less than v2 management in three places, on purpose (ENG-2868). `createdAt` and `updatedAt` are server-owned, because a client-set `createdAt` dodges monthly response metering and slips rows into another consumer's paginated stream. `contactAttributes` is not on the resource; it is a stale copy of the contact's. The contact is linked by `contactId` on create only, never by `userId` and never re-linked by PATCH: re-pointing a response at another contact is the ENG-1923 bug, and `userId` can match more than one contact.

## Consequences

- Importing history with its original dates needs v2 until an import path exists.
- Each rejected field sits on the deny-list in `apps/web/app/api/v3/responses/lib/reference-manifest.ts`, so adding one back is a visible decision.
