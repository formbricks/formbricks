import { authOptions } from "@/modules/auth/lib/authOptions";
import { createHash } from "crypto";
import { NextApiRequest, NextApiResponse } from "next";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";

export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export const getSessionUser = async (req?: NextApiRequest, res?: NextApiResponse) => {
  // check for session (browser usage)
  let session: Session | null;
  if (req && res) {
    session = await getServerSession(req, res, authOptions);
  } else {
    session = await getServerSession(authOptions);
  }
  if (session && "user" in session) return session.user;
};
