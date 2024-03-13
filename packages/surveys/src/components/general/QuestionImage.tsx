interface QuestionImageProps {
  imgUrl: string;
  altText?: string;
}

export default function QuestionImage({ imgUrl, altText = "Image" }: QuestionImageProps) {
  return (
    <div className="group mb-4 cursor-pointer rounded-md">
      <a href={imgUrl} target="_blank" rel="noreferrer" className="relative block h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgUrl} alt={altText} className="rounded-md" />

        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md bg-gray-800 p-2 text-sm text-white opacity-0 transition duration-300 ease-in-out hover:bg-gray-700 group-hover:opacity-100">
          <span>Open in new tab</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-square-arrow-up-right">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M8 8h8v8" />
            <path d="m8 16 8-8" />
          </svg>
        </div>
      </a>
    </div>
  );
}
