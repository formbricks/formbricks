interface HighlightedTextProps {
  readonly value: string;
  readonly searchValue: string;
}

export const HighlightedText = ({ value, searchValue }: HighlightedTextProps) => {
  if (!searchValue.trim()) {
    return <span>{value}</span>;
  }

  const escapedSearch = searchValue.replace(/[-/\\^$*+?.()|[\]{}]/g, String.raw`\$&`);
  const regex = new RegExp(`(${escapedSearch})`, "gi");

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
