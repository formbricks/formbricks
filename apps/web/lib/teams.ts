import useSWR from "swr";
import { fetcher } from "./fetcher";

export const useTeam = (environmentId: string) => {
    const { data, isLoading, error, isValidating } = useSWR(
        `/api/v1/teams/${environmentId}/members`,
        fetcher
    );

    return {
        team: data,
        isLoadingTeam: isLoading,
        isErrorTeam: error,
        isValidatingTeam: isValidating
    };
};


export const removeMember = async (teamId: string, userId: string) => {
    console.log("remove Member", userId, "from", teamId)
    return
    try {
        await fetch(`/api/v1/users/me/`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId, userId }),
        });
    } catch (error) {
        console.error(error);
    }
};

export const addMember = async (teamId: string, data: { name: string, email: string }) => {
    console.log("add Member", data.name, "to", teamId, "with email", data.email)
    return
    try {
        await fetch(`/api/v1/users/me/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId, userId }),
        });
    } catch (error) {
        console.error(error);
    }
};

export const resendInvite = async (teamId: string, userId: string) => {
    console.log("resend invite to", userId, "from", teamId)
    return
    try {
        await fetch(`/api/v1/users/me/`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId, userId }),
        });
    } catch (error) {
        console.error(error);
    }
}