// Utility function to render hyperlinked content
export const renderHyperlinkedContent = (data: string): JSX.Element[] => {
  const parts = data.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) =>
    part.match(/https?:\/\/[^\s]+/) ? (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500">
        {part}
      </a>
    ) : (
      <span key={index}>{part}</span>
    )
  );
};
