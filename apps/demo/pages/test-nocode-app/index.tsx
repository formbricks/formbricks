import formbricks from "@formbricks/js";
import Image from "next/image";
import { useEffect, useState } from "react";
import fbsetup from "../../public/fb-setup.png";

export default function AppPage({}) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <div className="h-full bg-white px-12 py-6 dark:bg-slate-800">
      <div className="flex flex-col justify-between md:flex-row">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Formbricks In-product Survey Demo App
          </h1>
          <p className="text-slate-700 dark:text-slate-300">
            This app helps you test your in-app surveys. You can create and test user actions, create and
            update user attributes, etc.
          </p>
        </div>
        <button
          className="mt-2 rounded-lg bg-slate-200 px-6 py-1 dark:bg-slate-700 dark:text-slate-100"
          onClick={() => setDarkMode(!darkMode)}>
          Toggle Dark Mode
        </button>
      </div>

      <div className="my-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="rounded-lg border border-slate-300 bg-slate-100 p-6 dark:border-slate-600 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">1. Setup .env</h3>
            <p className="text-slate-700 dark:text-slate-300">
              Copy the environment ID of your Formbricks app to the env variable in demo/.env
            </p>
            <Image src={fbsetup} alt="fb setup" className="mt-4 rounded" priority />

            <div className="mt-4 flex-col items-start text-sm text-slate-700 dark:text-slate-300 sm:flex sm:items-center sm:text-base">
              <p className="mb-1 sm:mb-0 sm:mr-2">You&apos;re connected with env:</p>
              <div className="flex items-center">
                <strong className="w-32 truncate sm:w-auto">
                  {process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID}
                </strong>
                <span className="relative ml-2 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
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
          <div className="col-span-3 rounded-lg border border-slate-300 bg-slate-100 p-6 dark:border-gray-600 dark:bg-gray-800">
            <h3 className="text-lg font-semibold dark:text-white">
              Reset person / pull data from Formbricks app
            </h3>
            <p className="text-slate-700 dark:text-gray-300">
              On formbricks.reset() a few things happen: <strong>New person is created</strong> and{" "}
              <strong>surveys & no-code actions are pulled from Formbricks:</strong>.
            </p>
            <button
              className="my-4 rounded-lg bg-slate-500 px-6 py-3 text-white hover:bg-slate-700 dark:bg-gray-700 dark:hover:bg-gray-600"
              onClick={() => {
                formbricks.reset();
              }}>
              Reset
            </button>
            <p className="text-xs text-slate-700 dark:text-gray-300">
              If you made a change in Formbricks app and it does not seem to work, hit &apos;Reset&apos; and
              try again.
            </p>
          </div>
          <div className="p-6">
            <div>
              <button
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-gray-700 dark:hover:bg-gray-600"
                onClick={() => {
                  console.log("Inner Text");
                }}>
                Inner Text
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-gray-300">Inner Text only</p>
            </div>
          </div>

          <div className="p-6">
            <div>
              <button
                id="css-id"
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-gray-700 dark:hover:bg-gray-600"
                onClick={() => {
                  console.log("Inner Text + CSS ID");
                }}>
                Inner Text
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-gray-300">Inner Text + Css ID</p>
            </div>
          </div>

          <div className="p-6">
            <div>
              <button
                className="css-class mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-gray-700 dark:hover:bg-gray-600"
                onClick={() => {
                  console.log("Inner Text + CSS Class");
                }}>
                Inner Text
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-gray-300">Inner Text + CSS Class</p>
            </div>
          </div>

          <div className="p-6">
            <div>
              <button
                id="css-id"
                className="css-class mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-gray-700 dark:hover:bg-gray-600"
                onClick={() => {
                  console.log("ID + Class");
                }}>
                ID and Class
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-gray-300">ID + Class</p>
            </div>
          </div>

          <div className="p-6">
            <div>
              <button
                id="css-id"
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-gray-700 dark:hover:bg-gray-600"
                onClick={() => {
                  console.log("ID + Class");
                }}>
                ID only
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-gray-300">ID only</p>
            </div>
          </div>

          <div className="p-6">
            <div>
              <button
                className="css-class mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-gray-700 dark:hover:bg-gray-600"
                onClick={() => {
                  console.log("Class only");
                }}>
                Class only
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-gray-300">Class only</p>
            </div>
          </div>

          <div className="p-6">
            <div>
              <button
                className="css-1 css-2 mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 dark:bg-gray-700 dark:hover:bg-gray-600"
                onClick={() => {
                  console.log("Class + Class");
                }}>
                Class + Class
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700 dark:text-gray-300">Class + Class</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
