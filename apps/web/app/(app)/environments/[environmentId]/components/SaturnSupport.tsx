"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    saturnSDK: any;
    $saturn: any;
  }
}

interface SaturnChatProps {
  userId: string;
  email: string;
  name: string | null;
  teamId: string;
  teamName: string;
}

export function SaturnChat({ userId, email, name, teamId, teamName }: SaturnChatProps) {
  useEffect(() => {
    const scriptElem = document.createElement("script");
    const BASE_URL = "https://app.saturnhq.io";
    scriptElem.src = `${BASE_URL}/assets/sdk.js`;
    scriptElem.defer = true;
    scriptElem.async = true;
    document.body.appendChild(scriptElem);

    scriptElem.onload = () => {
      window.saturnSDK.run({
        integrationId: "formbricks",
      });
    };
    return () => {
      document.body.removeChild(scriptElem);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const saturnChatbox = document.getElementsByClassName("saturn-chat-holder")[0];
      const inbuiltCloseIcon = document.getElementsByClassName("icon-container")[0];
      if (
        saturnChatbox &&
        inbuiltCloseIcon &&
        !saturnChatbox.contains(event.target as Node) &&
        !inbuiltCloseIcon.contains(event.target as Node)
      ) {
        window.$saturn.close();
      }
    };

    const setUser = () => {
      window.$saturn.setUser(
        userId,
        { email: email, name: name },
        { groups: { team: { id: teamId, name: teamName } } }
      );
    };

    if (window?.$saturn && window?.$saturn?.isLoaded) {
      setUser();
      window.$saturn.open();
    } else {
      window.addEventListener(
        "saturn:ready",
        function () {
          setUser();
          window.$saturn.open();
        },
        { once: true }
      );
    }
    document.addEventListener("mousedown", handleOutsideClick);
  }, [userId, email, name, teamId, teamName]);

  return <></>;
}
