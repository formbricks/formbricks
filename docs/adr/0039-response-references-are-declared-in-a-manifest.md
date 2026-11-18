# Ids in a response write are declared in a manifest, and a bad one is a 422 naming the field

Twelve security fixes on responses shared one shape: an id in the request body that one write path checked against the caller's workspace and another didn't (ENG-825 and ENG-1923 are the same bug on two paths). So every field of the write body is classified in a manifest beside the request schema, as a reference of a known kind or as not one, and a test holds that list equal to the schema's fields, so a new field fails until someone says what it is. Each referenced id is then checked by a workspace-scoped query and scoped again in the write itself. A contact, display or tag that is missing or belongs to another workspace is a 422 `invalid_reference` naming the field. Both cases come out of the same scoped query, so the answer can't tell them apart, and a caller can see which id was wrong.

## Considered Options

- **Per-route guards** (v1/v2): how the twelve fixes happened.
- **The uniform v3 403 for a bad reference too**: hides nothing the scoped query doesn't already hide, and makes a typo undebuggable.

## Consequences

- The survey a create targets is answered like a route resource: an unknown or foreign `surveyId` gets the uniform 403, as does the `responseId` in the path.
- A reference that falls out of scope between the check and the write gets the generic 403 instead of the 422.
