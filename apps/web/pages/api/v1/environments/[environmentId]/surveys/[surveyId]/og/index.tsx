import { ImageResponse } from "next/server";
import { NextRequest } from "next/server";

export const dynamic = "auto";
export const dynamicParams = true;
export const revalidate = false;
export const fetchCache = false;

// App router includes @vercel/og.
// No need to install it.

export const runtime = "edge";

export default async function GET(req: NextRequest) {
  let name = req.nextUrl.searchParams.get("surveyId");
  let brandColor = req.nextUrl.searchParams.get("brandColor");

  return new ImageResponse(
    (
      <div tw="flex flex-col w-full h-full items-center  bg-white rounded-xl">
        <div tw="flex flex-col w-full">
          <div tw="flex flex-col md:flex-row w-full py-12 px-4 md:items-center justify-between p-8">
            <div tw="flex flex-col  mt-5">
              <h2 tw="flex flex-col text-[8] sm:text-4xl font-extrabold tracking-tight text-gray-900 text-left">
                {name}
              </h2>
              <span tw="text-gray-600 text-xl">Complete in ~ 4 minutes</span>
            </div>
          </div>
          <div tw="flex  justify-end mr-10 mt-5">
            <div tw="flex rounded-2xl shadow  ">
              <a
                tw={`flex items-center justify-center rounded-2xl border border-transparent bg-[${brandColor}] px-5 py-3 text-2xl text-white h-16 w-34 font-extrabold`}>
                Begin!
              </a>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 635,
      height: 334,
    }
  );
}
