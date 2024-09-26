interface HighlightedTextProps {
  value: string;
  searchValue: string;
}

export const HighlightedText = ({ value, searchValue }: HighlightedTextProps) => {
  if (!searchValue.trim()) {
    return <span>{value}</span>;
  }

  const regex = new RegExp(`(${searchValue.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "gi");

  const parts = value.split(regex);

  return (
    <span className="text-slate-900">
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={`${part}-${index}`} className="bg-[#FFFF00]">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
};
