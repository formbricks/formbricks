import { hashPassword } from "./auth";
import useSWR from "swr";
import { fetcher } from "./utils";

export enum UserRoles {
  Public = "PUBLIC",
  Admin = "ADMIN",
}

export const createUser = async (
  firstname,
  lastname,
  gender,
  phone,
  email,
  password
) => {
  const hashedPassword = await hashPassword(password);
  try {
    const res = await fetch(`/api/public/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstname,
        lastname,
        gender,
        phone,
        email,
        password: hashedPassword,
      }),
    });
    if (res.status !== 200) {
      const json = await res.json();

      throw Error(json.error);
    }
    return await res.json();
  } catch (error) {
    throw Error(`${error.message}`);
  }
};

export const resendVerificationEmail = async (email) => {
  try {
    const res = await fetch(`/api/public/users/verification-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
      }),
    });
    if (res.status !== 200) {
      const json = await res.json();
      throw Error(json.error);
    }
    return await res.json();
  } catch (error) {
    throw Error(`${error.message}`);
  }
};

export const forgotPassword = async (email: string) => {
  try {
    const res = await fetch(`/api/public/users/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
      }),
    });
    if (res.status !== 200) {
      const json = await res.json();
      throw Error(json.error);
    }
    return await res.json();
  } catch (error) {
    throw Error(`${error.message}`);
  }
};

export const resetPassword = async (token, password) => {
  const hashedPassword = await hashPassword(password);
  try {
    const res = await fetch(`/api/public/users/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        hashedPassword,
      }),
    });
    if (res.status !== 200) {
      const json = await res.json();
      throw Error(json.error);
    }
    return await res.json();
  } catch (error) {
    throw Error(`${error.message}`);
  }
};

export const useUsers = () => {
  const { data, error, mutate } = useSWR(`/api/public/users`, fetcher);

  return {
    users: data,
    isLoadingUsers: !error && !data,
    isErrorUsers: error,
    mutateUsers: mutate,
  };
};

export const persistUserRole = async (data) => {
  try {
    await fetch(`/api/public/users/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data.role),
    });
  } catch (error) {
    console.error(error);
  }
};
