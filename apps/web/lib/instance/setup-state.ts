import { prisma } from "@formbricks/database";
import { INSTANCE_SETUP_ID } from "@formbricks/types/instance";

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
 * primary-key read.
 */
export const readInstanceSetupState = async (): Promise<TInstanceSetupState> => {
  if (await prisma.instanceSetup.findUnique({ where: { id: INSTANCE_SETUP_ID }, select: { id: true } })) {
    return "marked";
  }
  if (await prisma.user.findFirst({ select: { id: true } })) return "in-use";
  if (await prisma.organization.findFirst({ select: { id: true } })) return "in-use";
  return "fresh";
};

/**
 * Write the singleton marker: `INSERT … ON CONFLICT DO NOTHING`, so concurrent first writes (two pages of
 * one render, two sign-ups, a sign-up and a page) all succeed. Prisma's `upsert` with an empty `update`
 * does not run as a native upsert and raises a unique-constraint error on that race.
 */
export const writeInstanceSetupMarker = async (): Promise<void> => {
  await prisma.instanceSetup.createMany({ data: [{ id: INSTANCE_SETUP_ID }], skipDuplicates: true });
};
