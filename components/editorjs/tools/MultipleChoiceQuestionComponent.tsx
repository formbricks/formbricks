/* eslint-disable react-hooks/exhaustive-deps */
import { Switch } from "@headlessui/react";
import { TrashIcon, PhotoIcon } from "@heroicons/react/24/solid";
import { default as React } from "react";
import { v4 as uuidv4 } from "uuid";
import { classNames } from "../../../lib/utils";
import { upload } from "../../../lib/utils";

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
        image: "",
      },
    ],
  };
};

const MultipleChoiceQuestion = (props) => {
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
  const uploadImage = async (file, optionId) => {
    const imgUrl = (await upload(file)).Location;
    choiceData.options.map((option) => {
      if (optionId === option.id) return (option.image = imgUrl);
    });
    setChoiceData({ ...choiceData });
  };
  const onAddOption = () => {
    const newData = {
      ...choiceData,
    };
    newData.options.push({
      id: uuidv4(),
      label: "",
      image: "",
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
      <div className="relative font-bold leading-7 text-gray-800 text-md sm:truncate border-black">
        <input
          type="text"
          id="label"
          defaultValue={choiceData.label}
          onBlur={onInputChange("label")}
          className="w-full p-0 border-0 border-transparent ring-0 focus:ring-0 placeholder:text-gray-300"
          placeholder="Your Question"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-red-500 pointer-events-none">
          {choiceData.required ? "*" : ""}
        </div>
      </div>
      <div className="max-w-sm mt-2 space-y-2">
        {choiceData.options.map(
          (option, optionIdx) =>
            option && (
              <div
                key={optionIdx}
                className={classNames(
                  "w-3/4 flex items-center max-sm:w-full max-md:w-full max-sm:flex-col max-md:flex-col"
                )}
              >
                <span className="w-full flex items-center text-sm max-sm:items-start">
                  <span
                    className={classNames(
                      choiceData.multipleChoice
                        ? "rounded-full"
                        : "rounded-full",
                      "flex items-center justify-center w-4 h-4 bg-white border border-gray-300 max-sm:h-3 max-sm:w-3  max-sm:mt-1"
                    )}
                    aria-hidden="true"
                  >
                    <span className="rounded-full bg-white w-1.5 h-1.5 max-sm:w-2.5" />
                  </span>
                  <input
                    type="text"
                    defaultValue={option?.label}
                    onBlur={onOptionChange(optionIdx, "label")}
                    className="p-0 ml-3 font-medium text-gray-900 border-0 border-transparent outline-none focus:ring-0 focus:outline-none placeholder:text-gray-300  max-sm:pb-3"
                    placeholder={`Option ${optionIdx + 1}`}
                  />
                </span>
                <input
                  type="file"
                  hidden
                  id={option ? option.id : ""}
                  onChange={(e) => uploadImage(e.target.files[0], option.id)}
                />
                {option.image && <img src={option.image} alt={option.label} />}
                <div className="flex items-center">
                  <button className="p-1 mx-2 right-3">
                    <label htmlFor={option.id}>
                      <PhotoIcon className="w-4 h-4 text-gray-300" />
                    </label>
                  </button>
                  {optionIdx !== 0 && (
                    <button
                      onClick={() => onDeleteOption(optionIdx)}
                      className="p-1 mx-2 right-3"
                    >
                      <TrashIcon className="w-4 h-4 text-gray-300" />
                    </button>
                  )}
                </div>
              </div>
            )
        )}
      </div>
      <input
        type="text"
        id="help-text"
        defaultValue={choiceData.help}
        onBlur={onInputChange("help")}
        className="block w-full max-w-sm p-0 mt-2 text-sm font-light text-gray-500 border-0 border-transparent ring-0 focus:ring-0 placeholder:text-gray-300"
        placeholder="optional help text"
      />

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
          </Switch.Label>
        </Switch.Group>
      </div>
    </div>
  );
};

export default MultipleChoiceQuestion;
