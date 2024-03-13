interface QuestionImageProps {
  imgUrl: string;
  altText?: string;
}

export default function QuestionImage({ imgUrl, altText = "Image" }: QuestionImageProps) {
  return (
    <div className="group/image relative mb-4 block rounded-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgUrl} alt={altText} className="rounded-md" />
      <a
        href={imgUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-2 flex items-center gap-2 rounded-md bg-gray-800 bg-opacity-40 p-1.5 text-white opacity-0 backdrop-blur-lg transition duration-300 ease-in-out hover:bg-opacity-65 group-hover/image:opacity-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-expand">
          <path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8" />
          <path d="M3 16.2V21m0 0h4.8M3 21l6-6" />
          <path d="M21 7.8V3m0 0h-4.8M21 3l-6 6" />
          <path d="M3 7.8V3m0 0h4.8M3 3l6 6" />
        </svg>
      </a>
    </div>
  );
}
