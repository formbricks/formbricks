const pages = ["Members", "Billing & Plan"];

const Loading = () => {
  return (
    <div className="p-6">
      <div>
        <div className="flex items-center justify-between space-x-4 pb-4">
          <h1 className="text-3xl font-bold text-slate-800">Organization Settings</h1>
        </div>
      </div>
      <div className="mb-6 border-b border-slate-200">
        <div className="grid h-10 w-full grid-cols-[auto,1fr]">
          <nav className="flex h-full min-w-full items-center space-x-4" aria-label="Tabs">
            {pages.map((navElem) => (
              <div
                key={navElem}
                className="flex h-full items-center border-b-2 border-transparent px-3 text-sm font-medium text-slate-500 transition-all duration-150 ease-in-out hover:border-slate-300 hover:text-slate-700">
                {navElem}
              </div>
            ))}
          </nav>
          <div className="justify-self-end"></div>
        </div>
      </div>
      <div className="my-8 h-64 animate-pulse rounded-xl bg-slate-200"></div>
      <div className="my-8 h-96 animate-pulse rounded-md bg-slate-200"></div>
    </div>
  );
};

export default Loading;
