interface RankingResponseProps {
  value: string[];
}

export const RankingRespone = ({ value }: RankingResponseProps) => {
  return (
    <div className="my-1 font-semibold text-slate-700" dir="auto">
      {value.map(
        (item, index) =>
          item && (
            <div key={index} className="mb-1 flex items-center">
              <span className="mr-2 text-gray-400">#{index + 1}</span>
              <div className="rounded bg-gray-100 px-2 py-1">{item}</div>
            </div>
          )
      )}
    </div>
  );
};
