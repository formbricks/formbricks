import { hashPassword } from "./auth";

export const createUser = async (firstname, lastname, email, password) => {
  const hashedPassword = await hashPassword(password);
  try {
    const res = await fetch(`/api/public/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstname,
        lastname,
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
    const res = await fetch(`/api/public/users/verfication-email`, {
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
