import fbsetup from "../../public/fb-setup.png";
import formbricks from "@formbricks/js";
import Image from "next/image";

export default function AppPage({}) {
  return (
    <div className="px-12 py-6">
      <div>
        <h1 className="text-2xl font-bold">Formbricks In-product Survey Demo App</h1>
        <p className="text-slate-700">
          This app helps you test your in-app surveys. You can create an test user actions, create and update
          user attributes, etc.
        </p>
      </div>
      <div className="my-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="rounded-lg border border-slate-300 bg-slate-100 p-6">
            <h3 className="text-lg font-semibold">Setup .env</h3>
            <p className="text-slate-700">
              Copy the environment ID of your Formbricks app to the env variable in demo/.env
            </p>
            <Image src={fbsetup} alt="fb setup" className="mt-4 rounded" priority />
          </div>
          <div className="mt-4 rounded-lg border border-slate-300 bg-slate-100 p-6">
            <h3 className="text-lg font-semibold">Widget Logs</h3>
            <p className="text-slate-700">
              Look at the logs to understand how the widget works. <strong>Open your browser console</strong>{" "}
              to see the logs.
            </p>
            {/*           <div className="max-h-[40vh] overflow-y-auto py-4">
              <LogsContainer />
            </div> */}
          </div>
        </div>

        <div className="md:grid md:grid-cols-3">
          <div className="col-span-3 rounded-lg border border-slate-300 bg-slate-100 p-6">
            <h3 className="text-lg font-semibold">Reset person / pull data from Formbricks app</h3>
            <p className="text-slate-700">
              On formbricks.logout() a few things happen: <strong>New person is created</strong> and{" "}
              <strong>surveys & no-code actions are pulled from Formbricks:</strong>.
            </p>
            <button
              className="my-4 rounded-lg bg-slate-500 px-6 py-3 text-white hover:bg-slate-700"
              onClick={() => {
                formbricks.logout();
              }}>
              Logout
            </button>
            <p className="text-xs text-slate-700">
              If you made a change in Formbricks app and it does not seem to work, hit &apos;Logout&apos; and
              try again.
            </p>
          </div>

          <div className="p-6">
            <div>
              <button
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700"
                onClick={() => {
                  formbricks.track("Code Action");
                }}>
                Code Action
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sends a{" "}
                <a href="https://formbricks.com/docs/actions/code" className="underline" target="_blank">
                  Code Action
                </a>{" "}
                to the Formbricks API called &apos;Code Action&apos;. You will find it in the Actions Tab.
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700">
                No-Code Action
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sends a{" "}
                <a href="https://formbricks.com/docs/actions/no-code" className="underline" target="_blank">
                  No Code Action
                </a>{" "}
                as long as you created it beforehand in the Formbricks App.{" "}
                <a href="https://formbricks.com/docs/actions/no-code" target="_blank" className="underline">
                  Here are instructions on how to do it.
                </a>
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button
                onClick={() => {
                  formbricks.setAttribute("Plan", "Free");
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700">
                Set Plan to &apos;Free&apos;
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sets the{" "}
                <a
                  href="https://formbricks.com/docs/attributes/custom-attributes"
                  target="_blank"
                  className="underline">
                  attribute
                </a>{" "}
                &apos;Plan&apos; to &apos;Free&apos;. If the attribute does not exist, it creates it.
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button
                onClick={() => {
                  formbricks.setAttribute("Plan", "Paid");
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700">
                Set Plan to &apos;Paid&apos;
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sets the{" "}
                <a
                  href="https://formbricks.com/docs/attributes/custom-attributes"
                  target="_blank"
                  className="underline">
                  attribute
                </a>{" "}
                &apos;Plan&apos; to &apos;Paid&apos;. If the attribute does not exist, it creates it.
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button
                onClick={() => {
                  formbricks.setEmail("test@web.com");
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700">
                Set Email
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sets the{" "}
                <a
                  href="https://formbricks.com/docs/attributes/identify-users"
                  target="_blank"
                  className="underline">
                  user email
                </a>{" "}
                &apos;test@web.com&apos;
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button
                onClick={() => {
                  formbricks.setUserId("THIS-IS-A-VERY-LONG-USER-ID-FOR-TESTING");
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700">
                Set User ID
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sets an external{" "}
                <a
                  href="https://formbricks.com/docs/attributes/identify-users"
                  target="_blank"
                  className="underline">
                  user ID
                </a>{" "}
                to &apos;THIS-IS-A-VERY-LONG-USER-ID-FOR-TESTING&apos;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
