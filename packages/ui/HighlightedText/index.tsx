interface HighlightedTextProps {
  value: string;
  searchValue: string;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({ value, searchValue }) => {
  if (!searchValue.trim()) {
    return <span>{value}</span>;
  }

  const regex = new RegExp(`(${searchValue.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "gi");

  const parts = value.split(regex);

  return (
    <span className="text-slate-900">
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={`${part}-${index}`} style={{ backgroundColor: "yellow" }}>
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
};
