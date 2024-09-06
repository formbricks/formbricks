import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import formbricks from "@formbricks/js/website";
import { SurveySwitch } from "../../components/SurveySwitch";
import fbsetup from "../../public/fb-setup.png";

declare const window: any;

const AppPage = ({}) => {
  const [darkMode, setDarkMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    // enable Formbricks debug mode by adding formbricksDebug=true GET parameter
    const addFormbricksDebugParam = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.has("formbricksDebug")) {
        urlParams.set("formbricksDebug", "true");
        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        window.history.replaceState({}, "", newUrl);
      }
    };

    addFormbricksDebugParam();

    if (process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID && process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST) {
      const defaultAttributes = {
        language: "en",
      };

      formbricks.init({
        environmentId: process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
        apiHost: process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST,
        attributes: defaultAttributes,
      });
    }

    // Connect next.js router to Formbricks
    if (process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID && process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST) {
      const handleRouteChange = formbricks?.registerRouteChange;
      router.events.on("routeChangeComplete", handleRouteChange);

      return () => {
        router.events.off("routeChangeComplete", handleRouteChange);
      };
    }
  });

  return (
    <div className="h-screen bg-white px-12 py-6 dark:bg-slate-800">
      <div className="flex flex-col items-center justify-between md:flex-row">
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <SurveySwitch value="website" formbricks={formbricks} />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Formbricks Website Survey Demo App
            </h1>
            <p className="text-slate-700 dark:text-slate-300">
              This app helps you test your app surveys. You can create and test user actions, create and
              update user attributes, etc.
            </p>
          </div>
        </div>

        <button
          className="mt-2 rounded-lg bg-slate-200 px-6 py-1 dark:bg-slate-700 dark:text-slate-100"
          onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "Toggle Light Mode" : "Toggle Dark Mode"}
        </button>
      </div>

      <div className="my-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="rounded-lg border border-slate-300 bg-slate-100 p-6 dark:border-slate-600 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">1. Setup .env</h3>
            <p className="text-slate-700 dark:text-slate-300">
              Copy the environment ID of your Formbricks app to the env variable in /apps/demo/.env
            </p>
            <Image src={fbsetup} alt="fb setup" className="mt-4 rounded" priority />

            <div className="mt-4 flex-col items-start text-sm text-slate-700 sm:flex sm:items-center sm:text-base dark:text-slate-300">
              <p className="mb-1 sm:mb-0 sm:mr-2">You&apos;re connected with env:</p>
              <div className="flex items-center">
                <strong className="w-32 truncate sm:w-auto">
                  {process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID}
                </strong>
                <span className="relative ml-2 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-slate-300 bg-slate-100 p-6 dark:border-slate-600 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">2. Widget Logs</h3>
            <p className="text-slate-700 dark:text-slate-300">
              Look at the logs to understand how the widget works.{" "}
              <strong className="dark:text-white">Open your browser console</strong> to see the logs.
            </p>
            {/* <div className="max-h-[40vh] overflow-y-auto py-4">
              <LogsContainer />
            </div> */}
          </div>
        </div>

        <div className="md:grid md:grid-cols-3">
          <div className="col-span-3 self-start rounded-lg border border-slate-300 bg-slate-100 p-6 dark:border-slate-600 dark:bg-slate-800">
            <h3 className="text-lg font-semibold dark:text-white">
              Reset person / pull data from Formbricks app
            </h3>
            <p className="text-slate-700 dark:text-slate-300">
              On formbricks.reset() the local state will <strong>be deleted</strong> and formbricks gets{" "}
              <strong>reinitialized</strong>.
            </p>
            <button
              className="my-4 rounded-lg bg-slate-500 px-6 py-3 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              onClick={() => {
                formbricks.reset();
              }}>
              Reset
            </button>

            <p className="text-xs text-slate-700 dark:text-slate-300">
              If you made a change in Formbricks app and it does not seem to work, hit &apos;Reset&apos; and
              try again.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppPage;
