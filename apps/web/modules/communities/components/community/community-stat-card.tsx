export const CommunityStatCard = () => {
  return (
    <div
      className={"bg-primary-20 flex min-h-[187px] flex-col items-center justify-center gap-2 rounded-2xl"}>
      <div className="text-primary text-3xl font-bold">0</div>
      <div className="flex flex-row items-center justify-between">
        <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">{/* label */}</h3>
      </div>
    </div>
  );
};
