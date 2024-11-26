"use client";

import { formbricksEnabled } from "@/app/lib/formbricks";
import Intercom from "@intercom/messenger-js-sdk";
import type { Session } from "next-auth";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import formbricks from "@formbricks/js";
import { env } from "@formbricks/lib/env";

type UsageAttributesUpdaterProps = {
  numSurveys: number;
};

export const FormbricksClient = ({
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const crypto = require("crypto");

  const secretKey = "123"; // TODO: Move to env variable
  const hash = crypto.createHmac("sha256", secretKey).update(session.user.id).digest("hex");

  const initializeFormbricksAndSetupRouteChanges = useCallback(async () => {
    formbricks.init({
      environmentId: env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID || "",
      apiHost: env.NEXT_PUBLIC_FORMBRICKS_API_HOST || "",
      userId: session.user.id,
    });
    formbricks.setEmail(userEmail);
    formbricks.registerRouteChange();
  }, [session.user.id, userEmail]);

  const initializeIntercom = useCallback(() => {
    Intercom({
      app_id: "123", // TODO: Replace with env variable
      user_id: session.user.id,
      user_hash: hash,
      api_base: "https://api-iam.eu.intercom.io",
      name: userName,
      email: userEmail,
      created_at: userCreatedAt ? Math.floor(userCreatedAt.getTime() / 1000) : undefined,
    });
  }, [session.user.id, userName, userEmail, userCreatedAt]);

  useEffect(() => {
    if (formbricksEnabled && session?.user?.id && formbricks) {
      initializeFormbricksAndSetupRouteChanges();
    }
  }, [session, pathname, searchParams, initializeFormbricksAndSetupRouteChanges]);

  useEffect(() => {
    if (session?.user?.id) {
      initializeIntercom();
    }
  }, [session, initializeIntercom]);

  return null;
};

const updateUsageAttributes = (numSurveys) => {
  if (!formbricksEnabled) return;

  if (numSurveys >= 3) {
    formbricks.setAttribute("HasThreeSurveys", "true");
  }
};

export const UsageAttributesUpdater = ({ numSurveys }: UsageAttributesUpdaterProps) => {
  useEffect(() => {
    updateUsageAttributes(numSurveys);
  }, [numSurveys]);

  return null;
};
