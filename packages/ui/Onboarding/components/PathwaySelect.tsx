interface PathwaySelectProps {
  setselectedPathway: (pathway: "link" | "in-app" | null) => void;
  setprogress: (progress: number) => void;
}

export default function PathwaySelect({ setselectedPathway, setprogress }: PathwaySelectProps) {
  return (
    <div className="space-y-16 text-center">
      <div className="space-y-4">
        <p className="text-4xl font-medium">How would you like to start?</p>
        <p>You can always use both types of surveys</p>
      </div>
      <div className=" flex space-x-8">
        <div
          className="animation flex h-96 w-80 flex-col items-center justify-center rounded-2xl border border-slate-300 bg-white p-3 shadow-lg transition ease-in-out hover:scale-105"
          onClick={() => {
            setselectedPathway("link");
            setprogress(50);
          }}>
          <div className="h-full w-full rounded-xl bg-gray-500">Image</div>
          <div className="my-4">
            <p className="text-lg font-medium">Link Surveys</p>
            <p className="text-xs">Create a new survey and share it via link.</p>
          </div>
        </div>
        <div
          className="flex h-96 w-80 flex-col items-center justify-center rounded-2xl border border-slate-300 bg-white  p-3 shadow-lg transition ease-in-out hover:scale-105"
          onClick={() => {
            setselectedPathway("in-app");
            setprogress(50);
          }}>
          <div className="h-full w-full rounded-xl bg-gray-500">Image</div>
          <div className="my-4">
            <p className="text-lg font-medium ">In app surveys</p>
            <p className="text-xs">Run a targeted survey in a app or a website</p>
          </div>
        </div>
      </div>
    </div>
  );
}
