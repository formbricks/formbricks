import LoadingSpinner from "@/components/shared/LoadingSpinner";

export default function SuspenseLoader() {
    return (
        <div className="rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-7 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
                <div className="col-span-3 pl-6">User</div>
                <div className="col-span-2 text-center">User ID</div>
                <div className="text-center">Email</div>
                {/* <div className="text-center">Sessions</div> */}
            </div>
            <div className="w-full">
                <div className="m-2 grid h-16 grid-cols-7 content-center rounded-lg hover:bg-slate-100">
                    <div className="col-span-3 flex items-center pl-6 text-sm">
                        <div className="flex items-center">
                            <div className="ph-no-capture h-10 w-10 flex-shrink-0"></div>
                            <div className="ml-4">
                                <div className="ph-no-capture font-medium text-slate-900"></div>
                            </div>
                        </div>
                    </div>
                    <LoadingSpinner />
                    <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
                        <div className="ph-no-capture text-slate-900"></div>
                    </div>
                    <div className="ph-no-capture my-auto whitespace-nowrap text-center text-sm text-slate-500">
                        <div className="text-slate-900"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};