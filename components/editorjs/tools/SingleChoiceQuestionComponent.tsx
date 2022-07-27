/* eslint-disable react-hooks/exhaustive-deps */
import { TrashIcon } from "@heroicons/react/solid";
import { default as React } from "react";
import { v4 as uuidv4 } from "uuid";
import { classNames } from "../../../lib/utils";

const DEFAULT_INITIAL_DATA = () => {
  return {
    label: "",
    required: false,
    options: [
      {
        id: uuidv4(),
        label: "Label",
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

  const onAddOption = (e) => {
    const newData = {
      ...choiceData,
    };
    newData.options.push({
      id: uuidv4(),
      label: "Label",
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
      newData.options[index][fieldName] = e.currentTarget.textContent;
      updateData(newData);
    };
  };

  return (
    <>
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
      <div className="relative max-w-sm mt-3 -space-y-px bg-white rounded-md">
        {choiceData.options.map((option, optionIdx) => (
          <div
            key={option.label}
            className={classNames(
              optionIdx === 0 ? "rounded-tl-md rounded-tr-md" : "",
              optionIdx === choiceData.options.length - 1
                ? "rounded-bl-md rounded-br-md"
                : "",
              "relative border p-4 flex flex-col cursor-pointer md:pl-4 md:pr-6 focus:outline-none border-gray-200"
            )}
          >
            <span className="flex items-center text-sm">
              <span
                className="flex items-center justify-center w-4 h-4 bg-white border border-gray-300 rounded-full"
                aria-hidden="true"
              >
                <span className="rounded-full bg-white w-1.5 h-1.5" />
              </span>
              <span
                className="ml-3 font-medium text-gray-900 focus:outline-none"
                onBlur={onOptionChange(optionIdx, "label")}
                suppressContentEditableWarning={!props.readOnly}
                contentEditable={!props.readOnly}
              >
                {option.label}
              </span>
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
      <button
        className="mt-2 inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
        onClick={onAddOption}
      >
        Add option
      </button>
    </>
  );
};

export default SingleChoiceQuestion;
