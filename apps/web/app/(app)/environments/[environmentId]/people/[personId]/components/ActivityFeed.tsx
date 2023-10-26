import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";
import { ActivityItemContent, ActivityItemPopover } from "./ActivityItemComponents";
import { TEnvironment } from "@formbricks/types/environment";
import { TAction } from "@formbricks/types/actions";
import { ActivityItemIcon } from "./ActivityItemComponents";
import { useState } from "react";
interface ActivityFeedProps {
  actions: TAction[];
  sortByDate: boolean;
  environment: TEnvironment;
}

export default function ActivityFeed({ actions, sortByDate, environment }: ActivityFeedProps) {
  const [pageCount, setPageCount] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const handleShowMore = () => {
    setPageCount((prevCount) => prevCount + 1);
  };

  const sortedActivities: TAction[] = actions.sort((a, b) =>
    sortByDate
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const displayedActivities = sortedActivities.slice(0, pageCount * ITEMS_PER_PAGE);

  return (
    <div className="relative">
      {sortedActivities.length === 0 ? (
        <EmptySpaceFiller type={"event"} environment={environment} />
      ) : (
        <div>
          {displayedActivities.map(
            (actionItem, index) =>
              actionItem && (
                <li key={actionItem.id} className="list-none">
                  <div className="relative pb-12">
                    {index !== displayedActivities.length - 1 && (
                      <span
                        className="absolute left-6 top-4 -ml-px h-full w-0.5 bg-slate-200"
                        aria-hidden="true"
                      />
                    )}
                    <div className="relative">
                      <ActivityItemPopover actionItem={actionItem}>
                        <div className="flex space-x-3 text-left">
                          <ActivityItemIcon actionItem={actionItem} />
                          <ActivityItemContent actionItem={actionItem} />
                        </div>
                      </ActivityItemPopover>
                    </div>
                  </div>
                </li>
              )
          )}
          <div className="relative">
            {displayedActivities.length < sortedActivities.length && (
              <>
                <div className="absolute bottom-0 flex h-24 w-full items-end justify-center bg-gradient-to-b from-slate-50 to-transparent opacity-70"></div>

                <div className="absolute bottom-0 flex h-12 w-full items-center justify-center">
                  <button
                    onClick={handleShowMore}
                    className="my-2 flex h-8 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                    Show more
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
