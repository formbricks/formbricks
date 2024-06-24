import { PeopleSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PeopleSecondaryNavigation";
import { CircleHelpIcon } from "lucide-react";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getPeople, getPeopleCount } from "@formbricks/lib/person/service";
import { TPerson } from "@formbricks/types/people";
import { Button } from "@formbricks/ui/Button";
import { EmptySpaceFiller } from "@formbricks/ui/EmptySpaceFiller";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";
import { Pagination } from "@formbricks/ui/Pagination";
import { PersonCard } from "./components/PersonCard";

const Page = async ({
  params,
  searchParams,
}: {
  params: { environmentId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) => {
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

  const HowToAddPeopleButton = (
    <Button
      size="sm"
      href="https://formbricks.com/docs/app-surveys/user-identification"
      variant="secondary"
      target="_blank"
      EndIcon={CircleHelpIcon}>
      How to add people
    </Button>
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="People" cta={HowToAddPeopleButton}>
        <PeopleSecondaryNavigation activeId="people" environmentId={params.environmentId} />
      </PageHeader>
      {people.length === 0 ? (
        <EmptySpaceFiller
          type="table"
          environment={environment}
          emptyMessage="Your users will appear here as soon as they use your app ⏲️"
          noWidgetRequired={true}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid h-12 grid-cols-7 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
            <div className="col-span-3 pl-6">User</div>
            <div className="col-span-2 hidden text-center sm:block">User ID</div>
            <div className="col-span-2 hidden text-center sm:block">Email</div>
          </div>
          {people.map((person) => (
            <PersonCard person={person} key={person.id} />
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
    </PageContentWrapper>
  );
};

export default Page;
