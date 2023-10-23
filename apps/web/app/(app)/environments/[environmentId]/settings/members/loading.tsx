import { Skeleton } from "@formbricks/ui/Skeleton";

function LoadingCard({
  title,
  description,
  skeleton,
}: {
  title: string;
  description: string;
  skeleton: React.ReactNode;
}) {
  return (
    <div className="my-4 rounded-lg border border-slate-200">
      <div className="grid content-center rounded-lg bg-slate-100 px-6 py-5 text-left text-slate-900">
        <h3 className="text-lg font-medium leading-6">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="w-full">{skeleton}</div>
    </div>
  );
}

export default function Loading() {
  const cards = [
    {
      title: "Manage members",
      description: "Add or remove members in your team",
      skeleton: (
        <div className="flex flex-col space-y-4 p-4">
          <div className="flex items-center justify-end gap-4">
            <Skeleton className="h-12 w-40 rounded-lg" />
            <Skeleton className="h-12 w-40 rounded-lg" />
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="grid-cols-20 grid h-12 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-2"></div>
              <div className="col-span-5">Fullname</div>
              <div className="col-span-5">Email</div>
              <div className="col-span-3">Role</div>
              <div className="col-span-5"></div>
            </div>

            <div className="h-10"></div>
          </div>
        </div>
      ),
    },
    {
      title: "Team Name",
      description: "Give your team a descriptive name",
      skeleton: (
        <div className="flex flex-col p-4">
          <Skeleton className="mb-2 h-5 w-32" />
          <Skeleton className="mb-4 h-12 w-96 rounded-lg" />
          <Skeleton className="h-12 w-36 rounded-lg" />
        </div>
      ),
    },
    {
      title: "Public Support Email",
      description: "Add an email we share with respondents who couldn't submit feedback.",
      skeleton: (
        <div className="flex flex-col p-4">
          <Skeleton className="mb-2 h-5 w-32" />
          <Skeleton className="mb-4 h-12 w-96 rounded-lg" />
          <Skeleton className="h-12 w-36 rounded-lg" />
        </div>
      ),
    },
    {
      title: "Delete account",
      description: "Delete your account with all of your personal information and data.",
      skeleton: (
        <div className="flex flex-col p-4">
          <Skeleton className="mb-2 h-5 w-full" />
          <Skeleton className="h-12 w-36 rounded-lg" />
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="my-4 text-2xl font-medium leading-6 text-slate-800">Profile</h2>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </div>
  );
}
