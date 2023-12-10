import { randomBytes } from "crypto";

let user: {
  name: string;
  email: string;
  password: string;
} | null;

export const getUser = () => {
  if (!user) {
    const name = randomBytes(4).toString("hex");
    const email = `${name}@gmail.com`;
    const password = "Test@123";
    user = { name, email, password };
  }
  return user;
};
