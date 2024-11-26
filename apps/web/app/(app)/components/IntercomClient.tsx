"use client";

import Intercom from "@intercom/messenger-js-sdk";
import type { Session } from "next-auth";
import { useCallback, useEffect } from "react";

export const IntercomClient = ({
  session,
  userEmail,
  userName,
  userCreatedAt,
}: {
  session: Session;
  userEmail: string;
  userName: string;
  userCreatedAt: Date;
}) => {
  const crypto = require("crypto");

  const secretKey = "eH92d3gRYsztRrolQNwjijMfcfIFx57EhFjs9EKR"; // TODO: Move to env variable
  const hash = crypto.createHmac("sha256", secretKey).update(session.user.id).digest("hex");

  const initializeIntercom = useCallback(() => {
    Intercom({
      app_id: "u1x4ge59", // TODO: Replace with env variable
      user_id: session.user.id,
      user_hash: hash,
      api_base: "https://api-iam.eu.intercom.io",
      name: userName,
      email: userEmail,
      created_at: userCreatedAt ? Math.floor(userCreatedAt.getTime() / 1000) : undefined,
    });
  }, [session.user.id, userName, userEmail, userCreatedAt, hash]);

  useEffect(() => {
    if (session?.user?.id) {
      initializeIntercom();
    }
  }, [session, initializeIntercom]);

  return null;
};
