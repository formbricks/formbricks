"use server";

import { getInstanceId } from "@/lib/instance";

export type TSecurityUpdatesStatus = {
  enrolled: boolean;
  email?: string;
};

/**
 * Checks if the current instance is enrolled in security updates.
 *
 * TODO: Replace with actual EE server call
 * GET /security-updates/status?instanceId=xxx
 *
 * @returns The enrollment status and email if enrolled
 */
export const getSecurityUpdatesStatus = async (): Promise<TSecurityUpdatesStatus> => {
  const instanceId = await getInstanceId();

  if (!instanceId) {
    return { enrolled: false };
  }

  // TODO: Replace with actual EE server call
  // const response = await fetch(`${EE_SERVER_URL}/instances/${instanceId}/security-updates`);
  // if (!response.ok) {
  //   return { enrolled: false };
  // }
  // return await response.json();

  // Mock: Always return not enrolled for now
  return { enrolled: false };
};

/**
 * Enrolls the current instance in security updates.
 *
 * TODO: Replace with actual EE server call
 * POST /security-updates/enroll { instanceId, email }
 *
 * @param email - The email address to receive security updates
 * @returns Success status
 */
export const enrollInSecurityUpdates = async (email: string): Promise<{ success: boolean }> => {
  const instanceId = await getInstanceId();

  if (!instanceId) {
    throw new Error("Instance ID not found");
  }

  // TODO: Replace with actual EE server call
  // const response = await fetch(`${EE_SERVER_URL}/instances/${instanceId}/security-updates`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ instanceId, email }),
  // });
  //
  // if (!response.ok) {
  //   throw new Error("Failed to enroll in security updates");
  // }
  //
  // return await response.json();

  // Mock: Always succeed for now
  console.log(`[Mock] Enrolling instance ${instanceId} with email ${email}`);
  return { success: true };
};
