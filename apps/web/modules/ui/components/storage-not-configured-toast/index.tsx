"use client";

export const StorageNotConfiguredToast = () => {
  return (
    <div className="flex w-fit !max-w-md items-center justify-center gap-2">
      <span className="text-slate-900">File storage not set up</span>
      <a
        className="text-slate-900 underline"
        href="https://formbricks.com/docs/self-hosting/configuration/file-uploads"
        target="_blank"
        rel="noopener noreferrer">
        Learn more
      </a>
    </div>
  );
};
