import { TwitterPicker } from "react-color";

export default function ManageLayout({ survey, setSurvey, persistSurvey }) {
  const setSurveyAttribute = async (attribute, value) => {
    const updatedSurvey = { ...survey };
    updatedSurvey[attribute] = value;
    setSurvey(updatedSurvey);
    await persistSurvey(updatedSurvey);
  };

  return (
    <div className="mx-5 my-4 overflow-hidden overflow-y-auto bg-white rounded-lg shadow">
      <div className="px-4 py-5 sm:p-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Color Theme
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Choose the colors for your survey.
          </p>
        </div>
        <div className="my-6">
          <label className="block text-sm font-medium text-gray-700">
            Primary Color
          </label>
          <TwitterPicker
            color={survey.colorPrimary}
            onChangeComplete={(color) =>
              setSurveyAttribute("colorPrimary", color.hex)
            }
            triangle={"hide"}
            className="my-2"
          />
        </div>
      </div>
    </div>
  );
}
