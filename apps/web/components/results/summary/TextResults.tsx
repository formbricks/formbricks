import BaseResults from "./BaseResults";

export default function TextResults({ element }) {
  return (
    <BaseResults element={element}>
      <div className="my-4 mt-6 flow-root h-44 max-h-64 overflow-y-scroll px-8 text-center">
        <ul className="divide-ui-gray-light -my-5 divide-y">
          {element?.summary?.map((answer) => (
            <li key={answer} className="py-4">
              <div className="relative focus-within:ring-2 focus-within:ring-indigo-500">
                <h3 className="text-sm text-gray-700">
                  {/* Extend touch target to entire panel */}
                  <span className="absolute inset-0" aria-hidden="true" />
                  {answer}
                </h3>
                {/* <p className="mt-1 text-xs text-gray-300 line-clamp-2">
                  {timeSince(answer.createdAt.toISOString())}
                </p> */}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </BaseResults>
  );
}
