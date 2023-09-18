export default function AttributeTableHeading() {
  return (
    <>
      <div className="grid h-12 grid-cols-5 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-3 pl-6 ">Name</div>
        <div className="hidden text-center sm:block">Created</div>
        <div className="hidden text-center sm:block">Last Updated</div>
      </div>
    </>
  );
}
