export const ActionTableHeading = () => {
  return (
    <>
      <div className="grid h-12 grid-cols-6 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
        <span className="sr-only">Edit</span>
        <div className="col-span-4 pl-6">User Actions</div>
        <div className="col-span-2 text-center">Created</div>
      </div>
    </>
  );
};
