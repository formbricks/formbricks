# Attribute survey displays and responses to the creative that opened them

`Display.creativeId` is a nullable column with no foreign key, so history survives a creative's deletion (ENG-3912, ENG-3867). Responses get the reserved meta fields `openedByCreativeId` and `openedByCreativeName`; the server checks the creative belongs to the workspace and opens that survey, then stamps the name. The survey renderer creates the display, so it carries the optional `creativeId`; link surveys opened in a new tab receive `?creativeId=`, which needs link-page code to read it (undeclared params aren't stored, and anonymization strips `meta.url`). A customer field with the exact same name hides the reserved one, and the long names make that collision unlikely.

## Consequences

- A new SDK with an old cached renderer loses attribution silently until the cache expires (see ENG-3917).
