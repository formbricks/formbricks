/* eslint-disable react-hooks/exhaustive-deps */
import { Switch } from "@headlessui/react";
import { TrashIcon } from "@heroicons/react/24/solid";
import { default as React } from "react";
import { v4 as uuidv4 } from "uuid";
import { classNames } from "../../../lib/utils";

const DEFAULT_INITIAL_DATA = () => {
  return {
    label: "",
    required: false,
    multipleChoice: false,
    options: [
      {
        id: uuidv4(),
        label: "",
      },
    ],
  };
};

const SingleChoiceQuestion = (props) => {
  const [choiceData, setChoiceData] = React.useState(
    props.data.options.length > 0 ? props.data : DEFAULT_INITIAL_DATA
  );

  const updateData = (newData) => {
    setChoiceData(newData);
    if (props.onDataChange) {
      // Inform editorjs about data change
      props.onDataChange(newData);
    }
  };

  const onAddOption = () => {
    const newData = {
      ...choiceData,
    };
    newData.options.push({
      id: uuidv4(),
      label: "",
    });
    updateData(newData);
  };

  const onDeleteOption = (optionIdx) => {
    const newData = {
      ...choiceData,
    };
    newData.options.splice(optionIdx, 1);
    updateData(newData);
  };

  const onInputChange = (fieldName) => {
    return (e) => {
      const newData = {
        ...choiceData,
      };
      newData[fieldName] = e.currentTarget.value;
      updateData(newData);
    };
  };

  const onOptionChange = (index, fieldName) => {
    return (e) => {
      const newData = {
        ...choiceData,
      };
      newData.options[index][fieldName] = e.currentTarget.value;
      updateData(newData);
    };
  };

  return (
    <div className="pb-5">
      <div className="relative font-bold leading-7 text-gray-800 text-md sm:truncate">
        <input
          type="text"
          id="label"
          defaultValue={choiceData.label}
          onBlur={onInputChange("label")}
          className="w-full p-0 border-0 border-transparent ring-0 focus:ring-0 placeholder:text-gray-300"
          placeholder="Your Question"
        />
        {choiceData.required && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-red-500 pointer-events-none">
            *
          </div>
        )}
      </div>
      <div className="max-w-sm mt-2 space-y-2">
        {choiceData.options.map((option, optionIdx) => (
          <div
            key={option.label}
            className={classNames("relative flex items-start")}
          >
            <span className="flex items-center text-sm">
              <span
                className={classNames(
                  choiceData.multipleChoice ? "rounded-sm" : "rounded-full",
                  "flex items-center justify-center w-4 h-4 bg-white border border-gray-300"
                )}
                aria-hidden="true"
              >
                <span className="rounded-full bg-white w-1.5 h-1.5" />
              </span>
              <input
                type="text"
                defaultValue={option.label}
                onBlur={onOptionChange(optionIdx, "label")}
                className="p-0 ml-3 font-medium text-gray-900 border-0 border-transparent outline-none focus:ring-0 focus:outline-none placeholder:text-gray-300"
                placeholder={`Option ${optionIdx + 1}`}
              />
            </span>
            {optionIdx !== 0 && (
              <button
                onClick={() => onDeleteOption(optionIdx)}
                className="absolute p-1 right-3"
              >
                <TrashIcon className="w-4 h-4 text-gray-300" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="relative z-0 flex mt-2 divide-x divide-gray-200">
        <button
          className="mr-3 justify-center mt-2 inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          onClick={onAddOption}
        >
          Add option
        </button>
        <Switch.Group as="div" className="flex items-center pl-3">
          <Switch
            checked={choiceData.multipleChoice}
            onChange={() => {
              const newData = {
                ...choiceData,
              };
              newData.multipleChoice = !newData.multipleChoice;
              updateData(newData);
            }}
            className={classNames(
              choiceData.multipleChoice ? "bg-red-600" : "bg-gray-200",
              "relative inline-flex flex-shrink-0 h-4 w-7 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            )}
          >
            <span
              aria-hidden="true"
              className={classNames(
                choiceData.multipleChoice ? "translate-x-3" : "translate-x-0",
                "pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200"
              )}
            />
          </Switch>
          <Switch.Label as="span" className="ml-3">
            <span className="text-sm font-medium text-gray-700">
              Multiple Selection{" "}
            </span>
            {/*  <span className="text-sm text-gray-500">(Save 10%)</span> */}
          </Switch.Label>
        </Switch.Group>
      </div>
    </div>
  );
};

export default SingleChoiceQuestion;
