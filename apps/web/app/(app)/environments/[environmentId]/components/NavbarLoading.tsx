export const NavbarLoading = () => {
  // [UseTusk]

  return (
    <div>
      <div className="flex justify-between space-x-4 px-4 py-2">
        <div className="flex">
          <div className="mx-2 h-8 w-8 animate-pulse rounded-md bg-slate-200"></div>
          <div className="mx-2 h-8 w-20 animate-pulse rounded-md bg-slate-200"></div>
          <div className="mx-2 h-8 w-20 animate-pulse rounded-md bg-slate-200"></div>
          <div className="mx-2 h-8 w-20 animate-pulse rounded-md bg-slate-200"></div>
          <div className="mx-2 h-8 w-20 animate-pulse rounded-md bg-slate-200"></div>
          <div className="mx-2 h-8 w-20 animate-pulse rounded-md bg-slate-200"></div>
        </div>
        <div className="flex">
          <div className="mx-2 h-8 w-8 animate-pulse rounded-full bg-slate-200"></div>
          <div className="mx-2 h-8 w-20 animate-pulse rounded-md bg-slate-200"></div>
        </div>
      </div>
    </div>
  );
};
