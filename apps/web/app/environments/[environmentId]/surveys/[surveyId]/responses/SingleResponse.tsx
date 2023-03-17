import { PersonAvatar } from "@/components/ui/Avatars";
import { truncate } from "@/lib/utils";
import Link from "next/link";

interface OpenTextSummaryProps {
  data: any;
  environmentId: string;
}

export default function SingleResponse({ data, environmentId }: OpenTextSummaryProps) {
  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-6 pb-5 pt-6">
        <div>
          <Link className="flex items-center" href={`/environments/${environmentId}/people/${data.personId}`}>
            <PersonAvatar personId={data.personId} />

            <p className="ml-2">{truncate(data.personId, 16)}</p>

            <h3 className="pb-1 text-xl font-semibold text-slate-900">{data.personId}</h3>
          </Link>
        </div>
      </div>
      <div className="rounded-b-lg bg-white ">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-6">User</div>
          <div className="col-span-2 pl-6">Response</div>
          <div className="px-6">Time</div>
        </div>
        {data.data.map((response) => {
          return (
            <div key={response.id} className="text-sm text-slate-500">
              <p className="text-base font-semibold">{response.question}</p>
              <p className="my-1">{response.answer}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
