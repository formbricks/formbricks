import { prisma } from "@formbricks/database";
import { INSTANCE_SETUP_ID } from "@formbricks/types/instance";

const findInstanceSetupMarker = () =>
  prisma.instanceSetup.findUnique({ where: { id: INSTANCE_SETUP_ID }, select: { id: true } });

/** The answers of {@link readInstanceSetupState}. */
export type TInstanceSetupState = "marked" | "in-use" | "fresh";

/**
 * Whether the instance has been set up (ENG-7313), from the database alone:
 *
 * - `marked`: the persisted `InstanceSetup` row exists. Written when the first user is created, and by the
 *   migration for every database that already held a user or an organization. Nothing ever deletes it.
 * - `in-use`: no marker, but a user or an organization exists, which proves setup happened anyway (a
 *   database built with `db:push`, restored from before the migration, or whose marker write failed).
 * - `fresh`: no marker, no user and no organization: the only state in which setup is open.
 *
 * The one place the rule lives. Plain module, no `server-only` and no React `cache()`, so proxy can call
 * it as well as the render tree (`getIsFreshInstance`). Read-only: writing the marker is the caller's call.
 * The lookups short-circuit in the order a set-up instance answers soonest, so almost every call is one
 * primary-key read. Before answering `fresh`, the marker is read again: a first sign-up can write it after the
 * first read, and its user can be deleted before the user lookup runs. The marker is never removed, so the
 * second read sees it, and "no marker, no user, no organization" holds across the whole call.
 */
export const readInstanceSetupState = async (): Promise<TInstanceSetupState> => {
  if (await findInstanceSetupMarker()) return "marked";
  if (await prisma.user.findFirst({ select: { id: true } })) return "in-use";
  if (await prisma.organization.findFirst({ select: { id: true } })) return "in-use";
  return (await findInstanceSetupMarker()) ? "marked" : "fresh";
};

/**
 * Write the singleton marker: `INSERT … ON CONFLICT DO NOTHING`, so concurrent first writes (two pages of
 * one render, two sign-ups, a sign-up and a page) all succeed. Prisma's `upsert` with an empty `update`
 * does not run as a native upsert and raises a unique-constraint error on that race.
 */
export const writeInstanceSetupMarker = async (): Promise<void> => {
  await prisma.instanceSetup.createMany({ data: [{ id: INSTANCE_SETUP_ID }], skipDuplicates: true });
};
