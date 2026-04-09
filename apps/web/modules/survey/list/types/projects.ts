import { Environment, Project } from "@prisma/client";

export interface TUserProject extends Pick<Project, "id" | "name"> {
  environments: Pick<Environment, "id" | "type">[];
}
