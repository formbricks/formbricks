import { MonitorIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import formbricksWebsite from "@formbricks/js/website";

import fbsetup from "../../public/fb-setup.png";

declare const window: any;

export default function AppPage({}) {
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
        language: "de",
      };

      formbricksWebsite.init({
        environmentId: process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
        apiHost: process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST,
        attributes: defaultAttributes,
      });
    }

    // Connect next.js router to Formbricks
    if (process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID && process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST) {
      // const handleRouteChange = formbricksWebsite?.registerRouteChange;
      const handleRouteChange = (url: string) => {
        formbricksWebsite.registerRouteChange();

        if (url.includes("/app/website")) {
          removeFormbricksContainer();
        }
      };
      router.events.on("routeChangeComplete", handleRouteChange);

      return () => {
        router.events.off("routeChangeComplete", handleRouteChange);
      };
    }
  });

  const removeFormbricksContainer = () => {
    document.getElementById("formbricks-modal-container")?.remove();
    document.getElementById("formbricks-website-container")?.remove();
    localStorage.removeItem("formbricks-js-website");
  };

  return (
    <div className="h-screen bg-white px-12 py-6 dark:bg-slate-800">
      <div className="flex flex-col items-center justify-between md:flex-row">
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg bg-[#038178] p-2 text-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
            onClick={() => {
              removeFormbricksContainer();
              window.location.href = "/app";
            }}>
            <div className="flex items-center gap-2">
              <MonitorIcon className="h-10 w-10" />
              <span>In-App Demo</span>
            </div>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Formbricks Website Survey Demo App
            </h1>
            <p className="text-slate-700 dark:text-slate-300">
              This app helps you test your in-app surveys. You can create and test user actions, create and
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
          <div className="col-span-3 rounded-lg border border-slate-300 bg-slate-100 p-6 dark:border-slate-600 dark:bg-slate-800">
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
                formbricksWebsite.reset();
              }}>
              Reset
            </button>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              If you made a change in Formbricks app and it does not seem to work, hit &apos;Reset&apos; and
              try again.
            </p>
          </div>

          <div className="pt-6">
            <div>
              <button
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                onClick={() => {
                  formbricksWebsite.track("New Session");
                }}>
                Track New Session
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                This button sends an Action to the Formbricks API called &apos;New Session&apos;. You will
                find it in the Actions Tab.
              </p>
            </div>
          </div>

          <div className="pt-6">
            <div>
              <button
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                onClick={() => {
                  formbricksWebsite.track("Exit Intent");
                }}>
                Track Exit Intent
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                This button sends an Action to the Formbricks API called &apos;Exit Intent&apos;. You can also
                move your mouse to the top of the browser to trigger the exit intent.
              </p>
            </div>
          </div>

          <div className="pt-6">
            <div>
              <button
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                onClick={() => {
                  formbricksWebsite.track("50% Scroll");
                }}>
                Track 50% Scroll
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                This button sends an Action to the Formbricks API called &apos;50% Scroll&apos;. You can also
                scroll down to trigger the 50% scroll.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
