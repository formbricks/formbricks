interface OpenTextSummaryProps {
  data: any;
  environmentId: string;
}
import { InboxStackIcon } from "@heroicons/react/24/solid";
import { timeSince } from "@/lib/time";
import { PersonAvatar } from "@/components/ui/Avatars";
import Link from "next/link";
import { truncate } from "@/lib/utils";

export default function OpenTextSummary({ data, environmentId }: OpenTextSummaryProps) {
  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-6 pb-5 pt-6">
        <div>
          <h3 className="pb-1 text-xl font-semibold text-slate-900">{data.question.headline}</h3>
        </div>
        <div className="flex space-x-2 font-semibold text-slate-600">
          <div className="rounded-lg bg-slate-100 p-2 ">Open Text Question</div>
          <div className=" flex items-center rounded-lg  bg-slate-100 p-2">
            <InboxStackIcon className="mr-2 h-4 w-4 " />
            16 responses
          </div>
        </div>
      </div>
      <div className="rounded-b-lg bg-white ">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-6">User</div>
          <div className="col-span-2 pl-6">Response</div>
          <div className="px-6">Time</div>
        </div>
        {data.responses.map((response) => {
          return (
            <div
              key={response.id}
              className="grid  grid-cols-4 items-center border-b border-slate-100 py-2 text-slate-800">
              <div className="pl-6">
                <Link
                  className="flex items-center"
                  href={`/environments/${environmentId}/people/${response.personId}`}>
                  <PersonAvatar personId={response.personId} />

                  <p className="ml-2">{truncate(response.personId, 16)}</p>
                </Link>
              </div>
              <div className="col-span-2 pl-6">{response.value}</div>
              <div className="px-6">{timeSince(response.updatedAt)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
