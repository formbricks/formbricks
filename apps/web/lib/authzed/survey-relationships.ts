import "server-only";
import type { TAuthzedRelationship } from "./client";
import { SURVEY_RELATIONS } from "./relationship-map";

/**
 * The relationship set a survey row implies (ENG-3282). Pure, and free of the client and PostgreSQL, so
 * the projector (`./survey`) and the read-only backfill audit derive the expected set from one place.
 */

export type TSurveyProjectionRow = Readonly<{
  id: string;
  ownerId: string | null;
  visibility: "restricted" | "workspace";
  visibilityVersion: number;
  workspaceId: string;
}>;

const surveyEdge = (
  surveyId: string,
  relation: string,
  subject: Readonly<{ objectId: string; objectType: "user" | "workspace" }>
): TAuthzedRelationship => ({
  relation,
  resource: { objectId: surveyId, objectType: "survey" },
  subject,
});

/**
 * The exact relationship set a survey row implies.
 *
 * | Fact                         | Edge                                   |
 * | ---------------------------- | -------------------------------------- |
 * | always                       | `survey#workspace@workspace:W`         |
 * | owner set                    | `survey#owner@user:O`                  |
 * | `visibility = workspace`     | `survey#shared_workspace@workspace:W`  |
 * | `visibility = private`, owner | `survey#private_owner@user:O`          |
 *
 * Cross-tenant guard: the only workspace this can ever name is `row.workspaceId`. A
 * `shared_workspace` edge to any other workspace would grant that workspace's members read.
 */
export const expectedSurveyRelationships = (row: TSurveyProjectionRow): TAuthzedRelationship[] => {
  const workspace = { objectId: row.workspaceId, objectType: "workspace" } as const;
  const relationships = [surveyEdge(row.id, SURVEY_RELATIONS.workspace, workspace)];

  if (row.ownerId !== null) {
    relationships.push(
      surveyEdge(row.id, SURVEY_RELATIONS.owner, { objectId: row.ownerId, objectType: "user" })
    );
  }
  if (row.visibility === "workspace") {
    relationships.push(surveyEdge(row.id, SURVEY_RELATIONS.sharedWorkspace, workspace));
  } else if (row.ownerId !== null) {
    relationships.push(
      surveyEdge(row.id, SURVEY_RELATIONS.privateOwner, { objectId: row.ownerId, objectType: "user" })
    );
  }

  return relationships;
};

/** An edge's identity for set comparisons: relation, resource and subject, including a subject relation. */
export const surveyRelationshipKey = ({ relation, resource, subject }: TAuthzedRelationship): string =>
  JSON.stringify([
    relation,
    resource.objectType,
    resource.objectId,
    subject.objectType,
    subject.objectId,
    subject.relation ?? "",
  ]);

/**
 * Whether the graph holds exactly the edges a survey row implies, in any order: none of them missing and
 * nothing else present. A reconcile write set cannot answer this, because it touches every expected edge.
 */
export const surveyRelationshipsMatch = (
  current: ReadonlyArray<TAuthzedRelationship>,
  expected: ReadonlyArray<TAuthzedRelationship>
): boolean => {
  const currentKeys = new Set(current.map(surveyRelationshipKey));
  const expectedKeys = new Set(expected.map(surveyRelationshipKey));
  return currentKeys.size === expectedKeys.size && [...expectedKeys].every((key) => currentKeys.has(key));
};
