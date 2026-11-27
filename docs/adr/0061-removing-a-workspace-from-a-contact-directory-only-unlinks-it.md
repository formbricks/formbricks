# Removing a workspace from a contact directory only unlinks it

Removing a workspace from its contact directory clears the workspace's link and changes nothing else. The contacts it created, the private segments it made and its surveys' segment links all stay. A survey whose segment has filters therefore reaches nobody: the workspace can no longer identify anyone, and the SDK shows such a survey only to identified people in the segment. Re-adding the workspace to the same directory restores everything.

## Considered Options

- **Clear the segment link of the workspace's surveys.** Rejected: the SDK treats a survey with no segment as having no filters and shows it to every visitor, so a survey meant for 200 customers would suddenly show to everyone.
- **Delete the workspace's private segments.** Rejected for the same reason, and because it makes removal impossible to undo.

## Consequences

- Responses and displays that arrive for a contact the workspace can no longer reach are saved without a contact. Old responses keep their saved copy of the contact's attributes and show "Contact not available" in place of the link.
- A browser that identified a user before the removal can still show a targeted survey for up to 30 minutes, until its cached segments expire.
