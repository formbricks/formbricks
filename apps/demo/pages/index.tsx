import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import formbricks from "@formbricks/js";
import fbsetup from "../public/fb-setup.png";

declare const window: Window;

export default function AppPage(): React.JSX.Element {
  const [darkMode, setDarkMode] = useState(false);
  const router = useRouter();
  const userId = "THIS-IS-A-VERY-LONG-USER-ID-FOR-TESTING";
  const userAttributes = {
    language: "de",
    "Attribute 1": "one",
    "Attribute 2": "two",
    "Attribute 3": "three",
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    const initFormbricks = () => {
      // enable Formbricks debug mode by adding formbricksDebug=true GET parameter
      const addFormbricksDebugParam = (): void => {
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.has("formbricksDebug")) {
          urlParams.set("formbricksDebug", "true");
          const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
          window.history.replaceState({}, "", newUrl);
        }
      };

      addFormbricksDebugParam();

      if (process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID && process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST) {
        void formbricks.init({
          environmentId: process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
          appUrl: process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST,
          // userId,
          // attributes: userInitAttributes,
        });
      }

      // Connect next.js router to Formbricks
      if (process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID && process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST) {
        const handleRouteChange = formbricks.registerRouteChange;

        router.events.on("routeChangeComplete", () => {
          void handleRouteChange();
        });

        return () => {
          router.events.off("routeChangeComplete", () => {
            void handleRouteChange();
          });
        };
      }
    };

    initFormbricks();
  }, [router.events]);

  return (
    <div className="min-h-screen bg-white px-12 py-6 dark:bg-slate-800">
      <div className="flex flex-col justify-between md:flex-row">
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Formbricks In-product Survey Demo App
            </h1>
            <p className="text-slate-700 dark:text-slate-300">
              This app helps you test your app surveys. You can create and test user actions, create and
              update user attributes, etc.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="mt-2 rounded-lg bg-slate-200 px-6 py-1 dark:bg-slate-700 dark:text-slate-100"
          onClick={() => {
            setDarkMode(!darkMode);
          }}>
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
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
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
          </div>
        </div>

        <div className="md:grid md:grid-cols-3">
          <div className="col-span-3 self-start rounded-lg border border-slate-300 bg-slate-100 p-6 dark:border-slate-600 dark:bg-slate-900">
            <h3 className="text-lg font-semibold dark:text-white">
              Set a user ID / pull data from Formbricks app
            </h3>
            <p className="text-slate-700 dark:text-slate-300">
              On formbricks.setUserId() the user state will <strong>be fetched from Formbricks</strong> and
              the local state gets <strong>updated with the user state</strong>.
            </p>
            <button
              className="my-4 rounded-lg bg-slate-500 px-6 py-3 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              type="button"
              onClick={() => {
                void formbricks.setUserId(userId);
              }}>
              Set user ID
            </button>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              If you made a change in Formbricks app and it does not seem to work, hit &apos;Reset&apos; and
              try again.
            </p>
          </div>

          <div className="p-6">
            <div>
              <button
                type="button"
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">
                No-Code Action
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                This button sends a{" "}
                <a
                  href="https://formbricks.com/docs/actions/no-code"
                  rel="noopener noreferrer"
                  className="underline dark:text-blue-500"
                  target="_blank">
                  No Code Action
                </a>{" "}
                as long as you created it beforehand in the Formbricks App.{" "}
                <a
                  href="https://formbricks.com/docs/actions/no-code"
                  rel="noopener noreferrer"
                  target="_blank"
                  className="underline dark:text-blue-500">
                  Here are instructions on how to do it.
                </a>
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button
                type="button"
                onClick={() => {
                  void formbricks.setAttribute("Plan", "Free");
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">
                Set Plan to &apos;Free&apos;
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                This button sets the{" "}
                <a
                  href="https://formbricks.com/docs/attributes/custom-attributes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline dark:text-blue-500">
                  attribute
                </a>{" "}
                &apos;Plan&apos; to &apos;Free&apos;. If the attribute does not exist, it creates it.
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button
                type="button"
                onClick={() => {
                  void formbricks.setAttribute("Plan", "Paid");
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">
                Set Plan to &apos;Paid&apos;
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                This button sets the{" "}
                <a
                  href="https://formbricks.com/docs/attributes/custom-attributes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline dark:text-blue-500">
                  attribute
                </a>{" "}
                &apos;Plan&apos; to &apos;Paid&apos;. If the attribute does not exist, it creates it.
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button
                type="button"
                onClick={() => {
                  void formbricks.setEmail("test@web.com");
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">
                Set Email
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                This button sets the{" "}
                <a
                  href="https://formbricks.com/docs/attributes/identify-users"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline dark:text-blue-500">
                  user email
                </a>{" "}
                &apos;test@web.com&apos;
              </p>
            </div>
          </div>

          <div className="p-6">
            <div>
              <button
                type="button"
                onClick={() => {
                  void formbricks.setAttributes(userAttributes);
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">
                Set Multiple Attributes
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                This button sets the{" "}
                <a
                  href="https://formbricks.com/docs/attributes/identify-users"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline dark:text-blue-500">
                  user attributes
                </a>{" "}
                to &apos;one&apos;, &apos;two&apos;, &apos;three&apos;.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
