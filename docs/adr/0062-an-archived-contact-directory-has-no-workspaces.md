# An archived contact directory has no workspaces

A contact directory can be archived only once no workspace uses it, and archiving is always a separate, explicit action. Removing its last workspace leaves it active with no workspaces; to archive it, remove its workspaces first, then use Archive. The confirm step for removing the last workspace offers an unticked "Also archive this directory" box as a shortcut: it sends the same archive request as the Archive button, after the removal is saved, so the removal itself never archives. Archiving keeps the contacts, attribute keys and segments so old responses keep their history, and hides the directory from the list and the workspace picker. Unarchiving needs no workspace; it can add some in the same save.

## Considered Options

- **Archive switches the directory off but keeps its workspaces linked.** The first plan (ENG-7487). Rejected: a workspace linked to a directory it cannot use behaves exactly like one with no directory, only less visibly, and the impact of archiving would have to be explained a second time, apart from removal.
- **Archiving removes every workspace in one step.** Rejected: one confirm step covering many workspaces and their surveys is hard to read, while removing workspaces one at a time shows each impact where it happens.
- **One save that removes the last workspace and archives in the same request.** Rejected: it mixed two actions in the server's save. The "Also archive" box runs them as two requests instead, so Archive stays an action that knows nothing about removing workspaces.
- **An active directory always has at least one workspace, so removing or deleting its last one archives it.** The first version of this ADR. Rejected: it archived a directory the owner may want to keep using, for example while moving workspaces around, and it hid the directory from the list as a side effect nobody asked for.

## Consequences

- Deleting the last workspace of a directory leaves the directory active with no workspaces, and the delete dialog says so. A directory sits above workspaces, like a Feedback Dataset, so deleting a workspace does not delete its contacts.
- An active directory with no workspaces shows in the list as usual, and its Archive button is enabled.
- A directory cannot be deleted, archived or not. To remove its contacts, add a workspace to it and delete them there.
