"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { hasUserEnvironmentAccessCached } from "@formbricks/lib/environment/auth";
import {
  createActionClass,
  deleteActionClass,
  getActionClass,
  updateActionClass,
} from "@formbricks/lib/actionClass/service";
import { getServerSession } from "next-auth";
import { TActionClassInput } from "@formbricks/types/v1/actionClasses";

export async function deleteActionAction(actionId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const action = await getActionClass(actionId);
  if (!action) throw new Error("Action not found");

  const isAuthorized = await hasUserEnvironmentAccessCached(session.user.id, action.environmentId);

  if (isAuthorized) {
    await deleteActionClass(action.environmentId, action.id);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
}

export async function createActionAction(action: TActionClassInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const isAuthorized = await hasUserEnvironmentAccessCached(session.user.id, action.environmentId);

  if (isAuthorized) {
    return await createActionClass(action.environmentId, action);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
}

export async function updateActionAction(actionClassId: string, updatedAction: Partial<TActionClassInput>) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const action = await getActionClass(actionClassId);
  if (!action) throw new Error("Action not found");

  const isAuthorized = await hasUserEnvironmentAccessCached(session.user.id, action.environmentId);

  if (isAuthorized) {
    return await updateActionClass(action.environmentId, action.id, updatedAction);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
}
