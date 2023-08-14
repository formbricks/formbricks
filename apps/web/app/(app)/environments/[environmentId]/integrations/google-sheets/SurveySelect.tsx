import { TSurvey } from "@formbricks/types/v1/surveys"
import SurveyStatusIndicator from "@/components/shared/SurveyStatusIndicator"
import { Badge } from "@formbricks/ui";
import { ComputerDesktopIcon, LinkIcon } from "@heroicons/react/24/solid";

interface SurveySelectProps {
    surveys: TSurvey[]
}

export default function SurveySelect({ surveys, environmentId }) {
    return (
        <div className="flex flex-col">
            <h2 className="text-center text-2xl font-semibold my-2">Select a survey</h2>
            <p className="text-center">Select a survey you want to add google sheet integration to</p>
            <div className="grid grid-cols-2 place-content-stretch gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 mt-6">
                {surveys
                    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                    .map((survey) => (
                        <div key={survey.id} className="relative col-span-1 h-56">
                            <div className="delay-50 flex h-full flex-col justify-between rounded-md bg-white shadow transition ease-in-out hover:scale-105">
                                <div className="px-6 py-4">
                                    <Badge
                                        StartIcon={survey.type === "link" ? LinkIcon : ComputerDesktopIcon}
                                        startIconClassName="mr-2"
                                        text={
                                            survey.type === "link"
                                                ? "Link Survey"
                                                : survey.type === "web"
                                                    ? "In-Product Survey"
                                                    : ""
                                        }
                                        type="gray"
                                        size={"tiny"}
                                        className="font-base"></Badge>
                                    <p className="my-2 line-clamp-3 text-lg">{survey.name}</p>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    <div className="flex justify-between px-4 py-2 text-right sm:px-6">
                                        <div className="flex items-center">
                                            {survey.status !== "draft" && (
                                                <>
                                                    <SurveyStatusIndicator
                                                        status={survey.status}
                                                        tooltip
                                                        environmentId={environmentId}
                                                    />
                                                    <p className="ml-2 text-xs text-slate-400 ">
                                                        {survey.analytics.numResponses} responses
                                                    </p>
                                                </>
                                            )}
                                            {survey.status === "draft" && (
                                                <span className="text-xs italic text-slate-400">Draft</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    )
}
