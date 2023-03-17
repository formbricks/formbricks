import { PersonAvatar } from "@/components/ui/Avatars";
import { timeSince } from "@/lib/time";
import Link from "next/link";

interface OpenTextSummaryProps {
  data: any;
  environmentId: string;
}

export default function SingleResponse({ data, environmentId }: OpenTextSummaryProps) {
  console.log(data);

  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-6 pb-5 pt-6">
        <div className="flex items-center justify-between">
          <Link
            className="group flex items-center"
            href={`/environments/${environmentId}/people/${data.personId}`}>
            <PersonAvatar personId={data.personId} />
            <h3 className="ml-4 pb-1 text-xl font-semibold text-slate-600 group-hover:underline">
              {data.personId}
            </h3>
          </Link>
          <time className="text-slate-500" dateTime={timeSince(data.updatedAt)}>
            {timeSince(data.updatedAt)}
          </time>
        </div>
      </div>
      <div className="space-y-6 rounded-b-lg bg-white p-6">
        {data.data.map((response) => {
          return (
            <div key={response.id}>
              <p className="text-sm text-slate-500">{response.question}</p>
              <p className="my-1 text-lg font-semibold text-slate-700">{response.answer}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
