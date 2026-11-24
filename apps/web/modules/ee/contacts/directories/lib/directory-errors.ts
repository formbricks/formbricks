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

export class ContactDirectoryWorkspacesNotMovableError extends ContactDirectoryWorkspacesError {
  constructor(workspaceIds: string[]) {
    super("Some workspaces can't move to another contact directory", workspaceIds);
    this.name = "ContactDirectoryWorkspacesNotMovableError";
  }
}

export class ContactDirectoryWorkspacesCannotLeaveError extends ContactDirectoryWorkspacesError {
  constructor(workspaceIds: string[]) {
    super("A workspace can't leave its contact directory", workspaceIds);
    this.name = "ContactDirectoryWorkspacesCannotLeaveError";
  }
}
