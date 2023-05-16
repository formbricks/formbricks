import React from "react";
import { CheckCircleIcon, PauseCircleIcon } from "@heroicons/react/24/outline";
import footerLogo from "./footerlogo.svg";
import Image from "next/image";

const SurveyInactive = ({ status }) => {
  const icons = {
    paused: <PauseCircleIcon className="h-6 w-6" />,
    closed: <CheckCircleIcon className="h-20 w-20" />,
  };

  const descriptions = {
    paused: "This survey is temporarily paused.",
    closed: "This survey has been closed.",
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-white py-8 text-center">
      <div></div>
      <div className="flex flex-col items-center space-y-3">
        {icons[status]}
        <h1 className="mb-2 text-4xl font-bold">Survey {status}.</h1>
        <p className="text-lg text-gray-500">{descriptions[status]}</p>
      </div>
      <div>
        <Image src={footerLogo} alt="Brand logo" className="mx-auto w-56" />
        <a href="https://formbricks.com" className="text-brand-dark text-lg underline">
          Free & open-source
        </a>
      </div>
    </div>
  );
};

export default SurveyInactive;
