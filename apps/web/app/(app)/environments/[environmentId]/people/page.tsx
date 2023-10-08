export const revalidate = REVALIDATION_INTERVAL;

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { truncateMiddle } from "@/lib/utils";
import { PEOPLE_PER_PAGE, REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getPeople, getPeopleCount } from "@formbricks/lib/person/service";
import { TPerson } from "@formbricks/types/v1/people";
import { Pagination, PersonAvatar } from "@formbricks/ui";
import Link from "next/link";

const getAttributeValue = (person: TPerson, attributeName: string) =>
  person.attributes[attributeName]?.toString();

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
  const maxPageNumber = Math.ceil(totalPeople / PEOPLE_PER_PAGE);
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
            <Link
              href={`/environments/${params.environmentId}/people/${person.id}`}
              key={person.id}
              className="w-full">
              <div className="m-2 grid h-16  grid-cols-7 content-center rounded-lg hover:bg-slate-100">
                <div className="col-span-3 flex items-center pl-6 text-sm">
                  <div className="flex items-center">
                    <div className="ph-no-capture h-10 w-10 flex-shrink-0">
                      <PersonAvatar personId={person.id} />
                    </div>
                    <div className="ml-4">
                      <div className="ph-no-capture font-medium text-slate-900">
                        {getAttributeValue(person, "email") ? (
                          <span>{getAttributeValue(person, "email")}</span>
                        ) : (
                          <span>{person.id}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-2 my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 sm:block">
                  <div className="ph-no-capture text-slate-900">
                    {truncateMiddle(getAttributeValue(person, "userId"), 24)}
                  </div>
                </div>
                <div className="col-span-2 my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 sm:block">
                  <div className="ph-no-capture text-slate-900">{getAttributeValue(person, "email")}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {hidePagination ? null : (
        <Pagination
          baseUrl={`/environments/${params.environmentId}/people`}
          currentPage={pageNumber}
          totalItems={totalPeople}
          itemsPerPage={PEOPLE_PER_PAGE}
        />
      )}
    </>
  );
}
