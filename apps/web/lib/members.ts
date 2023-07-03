import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useMembers = (environmentId: string) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/members/`,
    fetcher
  );

  return {
    team: data,
    isLoadingTeam: isLoading,
    isErrorTeam: error,
    isValidatingTeam: isValidating,
    mutateTeam: mutate,
  };
};

export const updateMemberRole = async (teamId: string, userId: string, role: string) => {
  try {
    const result = await fetch(`/api/v1/teams/${teamId}/members/${userId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    return result.status === 200;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const removeMember = async (teamId: string, userId: string) => {
  try {
    const result = await fetch(`/api/v1/teams/${teamId}/members/${userId}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    return result.status === 200;
  } catch (error) {
    console.error(error);
    return false;
  }
};

// update invitee's role
export const updateInviteeRole = async (teamId: string, inviteId: string, role: string) => {
  try {
    const result = await fetch(`/api/v1/teams/${teamId}/invite/${inviteId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    return result.status === 200;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const deleteInvite = async (teamId: string, inviteId: string) => {
  try {
    const result = await fetch(`/api/v1/teams/${teamId}/invite/${inviteId}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    return result.status === 200;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const addMember = async (teamId: string, data: { name: string; email: string }) => {
  try {
    const result = await fetch(`/api/v1/teams/${teamId}/invite/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return result.status === 200;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const resendInvite = async (teamId: string, inviteId: string) => {
  try {
    const result = await fetch(`/api/v1/teams/${teamId}/invite/${inviteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });
    return result.status === 200;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const shareInvite = async (teamId: string, inviteId: string) => {
  try {
    const res = await fetch(`/api/v1/teams/${teamId}/invite/${inviteId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (res.status !== 200) {
      const json = await res.json();
      throw Error(json.message);
    }
    return res.json();
  } catch (error) {
    console.error(error);
    throw Error(`shareInvite: unable to get invite link: ${error.message}`);
  }
};
