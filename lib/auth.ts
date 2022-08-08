import { compare, hash } from "bcryptjs";

export async function hashPassword(password: string) {
  const hashedPassword = await hash(password, 12);
  return hashedPassword;
}

export async function verifyPassword(password: string, hashedPassword: string) {
  const isValid = await compare(password, hashedPassword);
  return isValid;
}
export function requireAuthentication(gssp) {
  return async (context) => {
    const { req, resolvedUrl } = context;
    const token = req.cookies.userToken;

    if (!token) {
      return {
        redirect: {
          destination: `/auth/signin?callbackUrl=${encodeURIComponent(
            resolvedUrl
          )}`,
          statusCode: 302,
        },
      };
    }

    return await gssp(context); // Continue on to call `getServerSideProps` logic
  };
}
