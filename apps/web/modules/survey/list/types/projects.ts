import { Environment, Project } from "@formbricks/database/generated/browser";

export interface TUserProject extends Pick<Project, "id" | "name"> {
  environments: Pick<Environment, "id" | "type">[];
}
