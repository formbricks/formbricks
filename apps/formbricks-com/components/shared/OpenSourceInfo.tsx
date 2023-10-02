import { Button } from "@formbricks/ui";

export const OpenSourceInfo = () => {
  return (
    <div className="my-8 md:my-20">
      <div className="px-8 md:px-16">
        <div className=" rounded-xl bg-slate-100 px-4 py-8 dark:bg-slate-800 md:px-12">
          <h2 className="text-lg font-semibold leading-7 tracking-tight text-slate-800 dark:text-slate-200 md:text-2xl">
            Open Source
          </h2>

          <p className=" my-2 text-slate-600 dark:text-slate-300">
            Formbricks is an open source project. You can self-host it for free. We provide multiple easy
            deployment options as per your customisation needs. We have documented the process of self-hosting
            Formbricks on your own server using Docker, Bash Scripting, and Building from Source.
          </p>
          <div className="mt-4 space-x-2">
            <Button
              variant="darkCTA"
              onClick={() => window.open("https://github.com/formbricks/formbricks", "_blank")}>
              Star us on GitHub
            </Button>
            <Button
              onClick={() => window.open("/docs/self-hosting/deployment", "_blank")}
              variant="secondary">
              Read our Docs on Self Hosting
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
