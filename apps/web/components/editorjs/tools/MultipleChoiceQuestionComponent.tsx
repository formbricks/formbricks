/* eslint-disable react-hooks/exhaustive-deps */
import { Switch } from "@headlessui/react";
import { TrashIcon } from "@heroicons/react/24/solid";
import { default as React } from "react";
import { v4 as uuidv4 } from "uuid";
import { classNames } from "../../../lib/utils";

const DEFAULT_INITIAL_DATA = () => {
  return {
    label: "",
    help: "",
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
      <div className="text-md relative font-bold leading-7 text-gray-800 sm:truncate">
        <input
          type="text"
          id="label"
          defaultValue={choiceData.label}
          onBlur={onInputChange("label")}
          className="w-full border-0 border-transparent p-0 ring-0 placeholder:text-gray-300 focus:ring-0"
          placeholder="Your Question"
        />
        {choiceData.required && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-red-500">
            *
          </div>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {choiceData.options.map((option, optionIdx) => (
          <div key={option.label} className="relative flex items-start pr-2 hover:rounded hover:bg-gray-50">
            <span className="flex w-full items-center text-sm ">
              <span
                className={classNames(
                  choiceData.multipleChoice ? "rounded-sm" : "rounded-full",
                  "flex h-4 w-4 items-center justify-center border border-gray-300"
                )}
                aria-hidden="true">
                <span className="h-1.5  w-1.5 rounded-full" />
              </span>
              <input
                type="text"
                defaultValue={option.label}
                onBlur={onOptionChange(optionIdx, "label")}
                className="ml-3 w-full border-0 border-transparent bg-transparent p-0 font-medium text-gray-900 outline-none placeholder:text-gray-300 focus:outline-none focus:ring-0"
                placeholder={`Option ${optionIdx + 1}`}
              />
              {optionIdx !== 0 && (
                <button onClick={() => onDeleteOption(optionIdx)} className="right-3 pl-4">
                  <TrashIcon className="h-4 w-4 text-gray-300" />
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
      <input
        type="text"
        id="help-text"
        defaultValue={choiceData.help}
        onBlur={onInputChange("help")}
        className="mt-2 block w-full max-w-sm border-0 border-transparent p-0 text-sm font-light text-gray-500 ring-0 placeholder:text-gray-300 focus:ring-0"
        placeholder="optional help text"
      />
      <div className="relative z-0 mt-2 flex divide-x divide-gray-200">
        <button
          className="mr-3 mt-2 inline-flex items-center justify-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none"
          onClick={onAddOption}>
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
              "relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            )}>
            <span
              aria-hidden="true"
              className={classNames(
                choiceData.multipleChoice ? "translate-x-3" : "translate-x-0",
                "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              )}
            />
          </Switch>
          <Switch.Label as="span" className="ml-3">
            <span className="text-sm font-medium text-gray-700">Multiple Selection </span>
            {/*  <span className="text-sm text-gray-500">(Save 10%)</span> */}
          </Switch.Label>
        </Switch.Group>
      </div>
    </div>
  );
};

export default SingleChoiceQuestion;
