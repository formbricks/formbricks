interface QuestionImageProps {
  imgUrl: string;
  altText?: string;
}

export default function QuestionImage({ imgUrl, altText = "Image" }: QuestionImageProps) {
  return (
    <div className="mb-4 rounded-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgUrl} alt={altText} className="mb-4 rounded-md" />
    </div>
  );
}
