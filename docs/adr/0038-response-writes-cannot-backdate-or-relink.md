# v3 response writes cannot backdate or re-link a contact

v3 deliberately accepts less than v2 management on response writes (ENG-2868). `createdAt` and `updatedAt` are server-owned, because a client-set `createdAt` dodges monthly response metering and slips rows into another consumer's paginated stream. The contact is linked by `contactId` on create only, never by `userId` and never re-linked by PATCH: re-pointing a response at another contact is how ENG-1923 crossed tenants, and `userId` can match more than one contact. `contactAttributes` is not on the resource at all, since it is a stale copy of the contact's; read them off the contact.

## Consequences

- Importing history with its original dates needs v2 until an import path exists.
- The refused create fields sit on the deny-list in `apps/web/app/api/v3/responses/lib/reference-manifest.ts`, so adding one back is a visible decision.
