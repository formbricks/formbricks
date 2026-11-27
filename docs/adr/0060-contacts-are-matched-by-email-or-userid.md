# Contacts are matched by email or userId, with no separate external ID

A contact directory matches contacts by email or by userId, chosen when the directory is made. An earlier draft of the contact directories feature had a third identifier, an External ID, used only by CSV upload and the bulk API, while the SDK identified people by userId. That gave one person two ids: someone identified in the app and the same person uploaded from a CRM became two contacts unless the CSV also carried their userId. Matching by userId makes the SDK and imports meet on the same contact. The cost is that a team whose app id and CRM id differ has to pick one of them, or match by email.

## Consequences

- The name stays `userId` for now, even though it now also means "the id from your CRM". Renaming it to External ID touches the SDKs and every public API, so it waits for the next major version (ADR 0050).
- In an email directory the SDK still identifies by userId and imports by email. Attaching an SDK call to the contact with the same email is a separate follow-up.
