export default function SuspenseLoader() {
    return (
        <div className="rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-7 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
                <div className="col-span-3 pl-6">User</div>
                <div className="col-span-2 text-center">User ID</div>
                <div className="col-span-2 text-center">Email</div>
            </div>
            <div className="w-full">
                {[...Array(3)].map((_, index) => (
                    <div
                        key={index}
                        className="m-2 grid h-16 grid-cols-7 content-center rounded-lg hover:bg-slate-100"
                    >
                        <div className="col-span-3 flex items-center pl-6 text-sm">
                            <div className="flex items-center">
                                <div className="ph-no-capture h-10 w-10 flex-shrink-0 animate-pulse bg-gray-200 rounded-full"></div>
                                <div className="ml-4">
                                    <div className="ph-no-capture font-medium text-slate-900 animate-pulse bg-gray-200 rounded-full w-28 h-4"></div>
                                </div>
                            </div>
                        </div>
                        <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
                            <div className="ph-no-capture text-slate-900 animate-pulse bg-gray-200 rounded-full m-12 h-4"></div>
                        </div>
                        <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
                            <div className="ph-no-capture text-slate-900 animate-pulse bg-gray-200 rounded-full m-12 h-4"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
