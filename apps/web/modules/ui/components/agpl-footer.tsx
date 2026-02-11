export function AgplFooter() {
  const sourceCodeUrl = process.env.NEXT_PUBLIC_SOURCE_CODE_URL || "https://github.com/ASLA1899/formbricks";

  return (
    <footer className="border-t border-slate-200 bg-white py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center text-sm text-slate-600">
          <span>This software is licensed under</span>
          <a
            href={sourceCodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 font-medium text-slate-900 underline hover:text-slate-700">
            AGPL v3
          </a>
          <span className="mx-2">|</span>
          <a
            href={sourceCodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 underline hover:text-slate-700">
            Source Code
          </a>
        </div>
      </div>
    </footer>
  );
}
