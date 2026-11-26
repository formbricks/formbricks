export class ContactDirectoryNotFoundError extends Error {
  constructor() {
    super("Contact directory not found");
    this.name = "ContactDirectoryNotFoundError";
  }
}

export class ContactDirectoryNameTakenError extends Error {
  constructor() {
    super("A contact directory with this name already exists in the organization");
    this.name = "ContactDirectoryNameTakenError";
  }
}

export class ContactDirectoryNameRequiredError extends Error {
  constructor() {
    super("A contact directory needs a name");
    this.name = "ContactDirectoryNameRequiredError";
  }
}

/** Carries the workspace ids the request named, so the route can point at them. */
abstract class ContactDirectoryWorkspacesError extends Error {
  readonly workspaceIds: string[];

  constructor(message: string, workspaceIds: string[]) {
    super(message);
    this.workspaceIds = workspaceIds;
  }
}

/** Unknown ids and ids of another organization's workspaces, which must look the same. */
export class ContactDirectoryWorkspacesNotFoundError extends ContactDirectoryWorkspacesError {
  constructor(workspaceIds: string[]) {
    super("Some workspaces were not found in the organization", workspaceIds);
    this.name = "ContactDirectoryWorkspacesNotFoundError";
  }
}

/** A workspace joins a directory only while it has none: no implicit move out of another directory. */
export class ContactDirectoryWorkspacesInOtherDirectoryError extends ContactDirectoryWorkspacesError {
  constructor(workspaceIds: string[]) {
    super("Some workspaces already use another contact directory", workspaceIds);
    this.name = "ContactDirectoryWorkspacesInOtherDirectoryError";
  }
}

/**
 * Directoryless workspaces that bring contacts a previous-release pod wrote, where joining would merge them
 * with the directory's own contacts (decision 15: no merge of contacts).
 */
export class ContactDirectoryWorkspacesNotMovableError extends ContactDirectoryWorkspacesError {
  constructor(workspaceIds: string[]) {
    super("Some workspaces bring contacts that can't join this contact directory", workspaceIds);
    this.name = "ContactDirectoryWorkspacesNotMovableError";
  }
}

/** An archived directory gets workspaces only by being unarchived in the same save (ADR 0062). */
export class ContactDirectoryArchivedError extends Error {
  constructor() {
    super("The contact directory is archived. Unarchive it to add workspaces");
    this.name = "ContactDirectoryArchivedError";
  }
}

/** Only a directory with no workspaces can be archived (ADR 0062). */
export class ContactDirectoryArchiveHasWorkspacesError extends Error {
  constructor() {
    super("A contact directory with workspaces can't be archived");
    this.name = "ContactDirectoryArchiveHasWorkspacesError";
  }
}
