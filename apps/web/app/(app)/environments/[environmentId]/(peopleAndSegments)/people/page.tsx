import HowToAddPeopleButton from "@/app/(app)/environments/[environmentId]/components/HowToAddPeopleButton";

import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getPeople, getPeopleCount } from "@formbricks/lib/person/service";
import { TPerson } from "@formbricks/types/people";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";
import { Pagination } from "@formbricks/ui/Pagination";

import { PersonCard } from "./components/PersonCard";

export default async function PeoplePage({
  params,
  searchParams,
}: {
  params: { environmentId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const pageNumber = searchParams.page ? parseInt(searchParams.page as string) : 1;
  const [environment, totalPeople] = await Promise.all([
    getEnvironment(params.environmentId),
    getPeopleCount(params.environmentId),
  ]);
  if (!environment) {
    throw new Error("Environment not found");
  }
  const maxPageNumber = Math.ceil(totalPeople / ITEMS_PER_PAGE);
  let hidePagination = false;

  let people: TPerson[] = [];

  if (pageNumber < 1 || pageNumber > maxPageNumber) {
    people = [];
    hidePagination = true;
  } else {
    people = await getPeople(params.environmentId, pageNumber);
  }

  return (
    <>
      <div className="mb-6 text-right">
        <div className="mb-6 flex items-center justify-end text-right">
          <HowToAddPeopleButton />
        </div>
      </div>
      {people.length === 0 ? (
        <EmptySpaceFiller
          type="table"
          environment={environment}
          emptyMessage="Your users will appear here as soon as they use your app ⏲️"
        />
      ) : (
        <div className="rounded-lg border border-slate-200">
          <div className="grid h-12 grid-cols-7 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
            <div className="col-span-3 pl-6 ">User</div>
            <div className="col-span-2 hidden text-center sm:block">User ID</div>
            <div className="col-span-2 hidden text-center sm:block">Email</div>
          </div>
          {people.map((person) => (
            <PersonCard person={person} />
          ))}
        </div>
      )}
      {hidePagination ? null : (
        <Pagination
          baseUrl={`/environments/${params.environmentId}/people`}
          currentPage={pageNumber}
          totalItems={totalPeople}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}
    </>
  );
}
