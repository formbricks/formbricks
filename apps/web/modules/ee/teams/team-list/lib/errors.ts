/** The team service's refusals that a caller can act on: typed, so routes map them without parsing text. */

/** Another team in the organization already has this name (`@@unique([organizationId, name])`). */
export class TeamNameTakenError extends Error {
  constructor() {
    super("Team name already exists");
    this.name = "TeamNameTakenError";
  }
}

/**
 * A team update names members or workspaces that aren't the team's organization's: users without a
 * membership there, workspaces of another organization, or the same one twice.
 */
export class TeamAssignmentOutsideOrganizationError extends Error {
  readonly field: "members" | "workspaces";

  constructor(field: "members" | "workspaces") {
    super(
      field === "members"
        ? "Some specified users do not belong to the organization's membership."
        : "Some specified workspaces do not belong to the organization."
    );
    this.name = "TeamAssignmentOutsideOrganizationError";
    this.field = field;
  }
}
