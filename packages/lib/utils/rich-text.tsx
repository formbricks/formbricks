export const parseRichText = (text: string): (string | JSX.Element)[] => {
  const parts = text.split(/(<b>.*?<\/b>)/g);

  return parts.map((part, index) => {
    if (part.startsWith("<b>") && part.endsWith("</b>")) {
      const content = part.slice(3, -4); // Remove <b> and </b>
      return <b key={index}>{content}</b>;
    }
    return part;
  });
};

export const RichText: React.FC<{ text: string }> = ({ text }) => {
  const parsedContent = parseRichText(text);
  return <>{parsedContent}</>;
};
