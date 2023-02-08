import LoadingSpinner from "@/components/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { camelToTitle } from "@/lib/utils";
import clsx from "clsx";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

interface Filter {
  name: string;
  label: string;
  type: string;
  options: {
    value: string;
    label: string;
    active: boolean;
  }[];
}

interface FilterNavigationProps {
  submissions: any[];
  setFilteredSubmissions: (submissions: any[]) => void;
  limitFields?: string[];
}

export default function FilterNavigation({
  submissions,
  setFilteredSubmissions,
  limitFields = null,
}: FilterNavigationProps) {
  const router = useRouter();
  const { formId, organisationId } = router.query;
  const [filters, setFilters] = useState<Filter[]>([]);

  const { form, isLoadingForm, isErrorForm } = useForm(formId?.toString(), organisationId?.toString());

  // filter submissions based on selected filters
  useEffect(() => {
    if (form) {
      let newFilteredSubmissions = JSON.parse(JSON.stringify(submissions));
      for (const filter of filters) {
        // special routine for archive
        if (filter.type === "archive") {
          const archivedSelected = filter.options.find((option) => option.value === "archived")?.active;
          if (archivedSelected) {
            newFilteredSubmissions = newFilteredSubmissions.filter((submission) => submission.archived);
          } else {
            newFilteredSubmissions = newFilteredSubmissions.filter((submission) => !submission.archived);
          }
          continue;
        }
        const isAllActive = filter.options.find((option) => option.value === "all")?.active;
        // no filter is all is selected, if not keep on filtering
        if (!isAllActive) {
          // filter for all other types
          if (filter.type === "radio") {
            for (const option of filter.options) {
              if (option.active) {
                newFilteredSubmissions = newFilteredSubmissions.filter((submission) => {
                  return submission.data[filter.name] === option.value;
                });
              }
            }
          } else if (filter.type === "checkbox") {
            for (const option of filter.options) {
              if (option.active) {
                newFilteredSubmissions = newFilteredSubmissions.filter((submission) => {
                  const value = submission.data[filter.name];
                  if (value) {
                    return value.includes(option.value);
                  }
                });
              }
            }
          }
        }
      }
      setFilteredSubmissions(newFilteredSubmissions);
    }
  }, [filters, form, submissions, setFilteredSubmissions]);

  const chosseOptionFilter = (filterName, optionValue) => {
    const newFilters = [...filters];
    const filter = newFilters.find((filter) => filter.name === filterName);

    if (filter) {
      // reset all previous filter options
      for (const option of filter.options) {
        if (option.value === optionValue) {
          option.active = true;
        } else {
          option.active = false;
        }
      }
    }
    setFilters(newFilters);
  };

  useEffect(() => {
    // build filters based on form schema
    if (form && form.schema) {
      const filters = [];
      for (const page of form.schema.pages) {
        for (const element of page.elements) {
          if (
            ["radio", "checkbox"].includes(element.type) &&
            (!limitFields || limitFields.includes(element.name))
          ) {
            filters.push({
              name: element.name,
              label: element.label,
              type: element.type,
              options: [{ value: "all", label: "All", active: true }].concat([
                ...element.options.map((option) => ({ ...option, active: false })),
              ]),
            });
          }
        }
      }
      // add archived filter at the end
      filters.push({
        name: "archive",
        label: "Archive",
        type: "archive",
        options: [
          { value: "inbox", label: "Inbox", active: true },
          { value: "archived", label: "Archived", active: false },
        ],
      });
      setFilters(filters);
    }
  }, [form, limitFields]);

  if (isLoadingForm) {
    return <LoadingSpinner />;
  }

  if (isErrorForm) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }

  return (
    <div className="space-y-4">
      {filters.map((filter) => (
        <div key={filter.name}>
          <div className="flex py-2 text-sm font-bold">
            <h4 className="text-slate-600">{camelToTitle(filter.name)}</h4>
          </div>
          {filter.options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                chosseOptionFilter(filter.name, option.value);
              }}
              className={clsx(
                option.active
                  ? "bg-gray-200 text-gray-900"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium"
              )}
              aria-current={option.active ? "page" : undefined}>
              <div className={clsx("-ml-1 mr-3 h-2 w-2 flex-shrink-0 rounded-full")} />
              <span className="truncate">{option.label}</span>
              {/* {item.count ? (
              <span
                className={clsx(
                  item.id === currentFilter ? "bg-white" : "bg-gray-100 group-hover:bg-white",
                  "ml-auto inline-block rounded-full py-0.5 px-3 text-xs"
                )}>
                {item.count}
              </span>
            ) : null} */}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
