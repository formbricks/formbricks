import { NextApiRequest, NextApiResponse } from "next";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getSession } from "@/modules/auth/lib/session";

export const getSessionUser = async (req?: NextApiRequest, res?: NextApiResponse) => {
  // check for session (browser usage)
  let session: Session | null;
  if (req && res) {
    session = await getServerSession(req, res, authOptions);
  } else {
    session = await getSession();
  }
  if (session && "user" in session) return session.user;
};
