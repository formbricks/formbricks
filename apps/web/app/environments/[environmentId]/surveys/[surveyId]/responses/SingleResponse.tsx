import { PersonAvatar } from "@formbricks/ui";
import { timeSince } from "@formbricks/lib/time";
import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

interface OpenTextSummaryProps {
  data: any;
  environmentId: string;
}

export default function SingleResponse({ data, environmentId }: OpenTextSummaryProps) {
  return (
    <div className=" my-6 rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-6 pb-5 pt-6">
        <div className="flex items-center justify-between">
          <Link
            className="group flex items-center"
            href={`/environments/${environmentId}/people/${data.personId}`}>
            <PersonAvatar personId={data.personId} />
            <h3 className="ml-4 pb-1 font-semibold text-slate-600 group-hover:underline">{data.personId}</h3>
          </Link>
          <div className="flex space-x-4 text-sm">
            {data.finished && (
              <span className="flex items-center rounded-full bg-slate-100 px-3 text-slate-600">
                Completed <CheckCircleIcon className="ml-1 h-5 w-5 text-green-400" />
              </span>
            )}
            <time className="text-slate-500" dateTime={timeSince(data.updatedAt)}>
              {timeSince(data.updatedAt)}
            </time>
          </div>
        </div>
      </div>
      <div className="space-y-6 rounded-b-lg bg-white p-6">
        {data.data.map((response) => {
          return (
            <div key={response.id}>
              <p className="text-sm text-slate-500">{response.question}</p>
              <p className="my-1 font-semibold text-slate-700">{response.answer}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
