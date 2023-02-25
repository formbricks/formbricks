import EmptyPageFiller from "@/components/EmptyPageFiller";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { camelToTitle, filterUniqueById } from "@/lib/utils";
import { RectangleGroupIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { BsPin, BsPinFill } from "react-icons/bs";

interface Filter {
  name: string;
  label: string;
  type: string;
  options: {
    value: string;
    label: string;
    active: boolean;
    pinned: boolean;
  }[];
}

interface FilterNavigationProps {
  submissions: any[];
  setFilteredSubmissions: (submissions: any[]) => void;
  limitFields?: string[];
  setNumTotalSubmissions?: (any?) => void;
}

export default function FilterNavigation({
  submissions,
  setFilteredSubmissions,
  limitFields = null,
  setNumTotalSubmissions = () => {},
}: FilterNavigationProps) {
  const router = useRouter();
  const { formId, organisationId } = router.query;
  const [filters, setFilters] = useState<Filter[]>([]);

  const { form, isLoadingForm, isErrorForm } = useForm(formId?.toString(), organisationId?.toString());

  // get all the tags from the submissions
  const tags = useMemo(() => {
    const tags = [];
    for (const submission of submissions) {
      for (const tag of submission.tags) {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }
    }
    return tags;
  }, [submissions]);

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
            setNumTotalSubmissions([...submissions].filter((s) => s.archived).length);
          } else {
            newFilteredSubmissions = newFilteredSubmissions.filter((submission) => !submission.archived);
            setNumTotalSubmissions([...submissions].filter((s) => !s.archived).length);
          }

          continue;
        } else if (filter.type === "tags") {
          const isAllActive = filter.options.find((option) => option.value === "all")?.active;
          // no filter is all is selected, if not keep on filtering
          if (!isAllActive) {
            // filter for all other types
            let listOfValidFilteredSubmissions = [];

            for (const option of filter.options) {
              if (option.active || option.pinned) {
                listOfValidFilteredSubmissions.push(
                  newFilteredSubmissions.filter((submission) => {
                    if (submission.tags) {
                      return submission.tags.includes(option.value);
                    }
                  })
                );
              }
            }
            // add pinned submissions to the top
            const flattenedListOfValidFilteredSubmissions = listOfValidFilteredSubmissions.flat();
            newFilteredSubmissions = filterUniqueById(flattenedListOfValidFilteredSubmissions);
          }
          continue;
        }

        const isAllActive = filter.options.find((option) => option.value === "all")?.active;
        // no filter is all is selected, if not keep on filtering
        if (!isAllActive) {
          // filter for all other types
          let listOfValidFilteredSubmissions = [];
          if (filter.type === "radio") {
            for (const option of filter.options) {
              if (option.active || option.pinned) {
                listOfValidFilteredSubmissions.push(
                  [...newFilteredSubmissions].filter((submission) => {
                    return submission.data[filter.name] === option.value;
                  })
                );
              }
            }
          } else if (filter.type === "checkbox") {
            for (const option of filter.options) {
              if (option.active || option.pinned) {
                listOfValidFilteredSubmissions.push(
                  newFilteredSubmissions.filter((submission) => {
                    const value = submission.data[filter.name];
                    if (value) {
                      return value.includes(option.value);
                    }
                  })
                );
              }
            }
          }
          // add pinned submissions to the top
          const flattenedListOfValidFilteredSubmissions = listOfValidFilteredSubmissions.flat();
          newFilteredSubmissions = filterUniqueById(flattenedListOfValidFilteredSubmissions);
        }
      }
      setFilteredSubmissions(newFilteredSubmissions);
    }
  }, [filters, form, submissions, setFilteredSubmissions]);

  const chooseOptionFilter = (filterName, optionValue, optionActive) => {
    const newFilters = [...filters];
    const filter = newFilters.find((filter) => filter.name === filterName);

    if (filter) {
      // activate option & deactivate all others
      if (!optionActive) {
        // reset all previous filter options
        for (const option of filter.options) {
          if (option.value === optionValue) {
            option.active = true;
          } else {
            option.active = false;
          }
          // reset all pins when all is selected
          if (optionValue === "all") {
            option.pinned = false;
          }
        }
      } else {
        // deactivate option if already active
        const option = filter.options.find((option) => option.value === optionValue);
        if (option) {
          option.active = false;
        }
        // check if something is pinned
        const pinnedOption = filter.options.find((option) => option.pinned);
        if (!pinnedOption) {
          // activate all option if noting is pinned
          const option = filter.options.find((option) => option.value === "all");
          if (option) {
            option.active = true;
          }
        }
      }
    }
    setFilters(newFilters);
  };

  const pinOptionFilter = (filterName, optionValue, pinValue) => {
    const newFilters = [...filters];
    const filter = newFilters.find((filter) => filter.name === filterName);

    if (filter) {
      const option = filter.options.find((option) => option.value === optionValue);
      if (option) {
        option.pinned = pinValue;
      }
    }
    setFilters(newFilters);
  };

  useEffect(() => {
    const prevFilters = [...filters];
    // build filters based on form schema
    if (form && form.schema && Object.keys(form.schema).length > 0) {
      const filters = [];
      for (const page of form.schema.pages) {
        for (const element of page.elements) {
          if (
            ["radio", "checkbox"].includes(element.type) &&
            (!limitFields || limitFields.includes(element.name))
          ) {
            const prevFilter = prevFilters.find((filter) => filter.name === element.name);
            filters.push({
              name: element.name,
              label: element.label,
              type: element.type,
              options: [
                {
                  value: "all",
                  label: "All",
                  active: !prevFilter
                    ? true
                    : prevFilter?.options?.find((o) => o.value === "all")?.active
                    ? true
                    : false,
                  pinned: prevFilter?.options?.find((o) => o.value === "all")?.pinned ? true : false,
                },
              ].concat([
                ...element.options.map((option) => ({
                  ...option,
                  active: prevFilter?.options?.find((o) => o.value === option.value)?.active ? true : false,
                  pinned: prevFilter?.options?.find((o) => o.value === option.value)?.pinned ? true : false,
                })),
              ]),
            });
          }
        }
      }
      // add archived filter at the end
      let prevFilter = prevFilters.find((filter) => filter.name === "archive");
      filters.push({
        name: "archive",
        label: "Archive",
        type: "archive",
        options: [
          {
            value: "inbox",
            label: "Inbox",
            active: !prevFilter ? true : prevFilter?.options[0]?.active ? true : false,
          },
          {
            value: "archived",
            label: "Archived",
            active: !prevFilter ? false : prevFilter?.options[1]?.active ? true : false,
          },
        ],
      });
      // add tag selection to filters
      prevFilter = prevFilters.find((filter) => filter.name === "tags");
      filters.push({
        name: "tags",
        label: "Tags",
        type: "tags",
        options: [
          {
            value: "all",
            label: "All",
            active: !prevFilter
              ? true
              : prevFilter?.options?.find((o) => o.value === "all")?.active
              ? true
              : false,
            pinned: prevFilter?.options?.find((o) => o.value === "all")?.pinned ? true : false,
          },
        ].concat([
          ...tags.sort().map((tag) => ({
            value: tag,
            label: tag,
            active: prevFilter?.options?.find((o) => o.value === tag)?.active ? true : false,
            pinned: prevFilter?.options?.find((o) => o.value === tag)?.pinned ? true : false,
          })),
        ]),
      });
      setFilters(filters);
    }
  }, [form, limitFields, tags]);

  if (isLoadingForm) {
    return <LoadingSpinner />;
  }

  if (isErrorForm) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }

  return form.schema && Object.keys(form.schema).length > 0 ? (
    <div className="space-y-4">
      {filters.map((filter) => (
        <div key={filter.name}>
          <div className="flex space-x-10 py-2 text-sm font-bold">
            <h4 className="text-slate-600">{camelToTitle(filter.name)}</h4>
          </div>
          {filter.options.map((option) => (
            <div key={option.value} className="relative">
              <button
                type="button"
                onClick={() => {
                  chooseOptionFilter(filter.name, option.value, option.active);
                }}
                className={clsx(
                  option.active || option.pinned
                    ? "bg-slate-200 text-slate-900"
                    : "text-slate-600  hover:bg-slate-100 hover:text-slate-900",
                  "group my-1 flex w-full items-center rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200"
                )}
                aria-current={option.active ? "page" : undefined}>
                <span className="truncate">{option.label}</span>
              </button>
              {!["all", "inbox", "archived"].includes(option.value) && (option.active || option.pinned) && (
                <button
                  className="absolute right-2 top-1 rounded px-2 py-1 transition-all duration-100 hover:bg-slate-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    pinOptionFilter(filter.name, option.value, !option.pinned);
                  }}>
                  {option.pinned ? (
                    <BsPinFill className="h-4 w-4 text-gray-400" />
                  ) : (
                    <BsPin className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  ) : (
    <EmptyPageFiller
      alertText="No schema found"
      hintText="Please add a schema to your form to use the filter navigation."
      borderStyles="border-4 border-dotted border-red">
      <RectangleGroupIcon className="stroke-thin mx-auto h-24 w-24 text-slate-300" />
    </EmptyPageFiller>
  );
}
