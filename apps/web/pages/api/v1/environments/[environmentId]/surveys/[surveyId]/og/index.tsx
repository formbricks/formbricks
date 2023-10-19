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
  let name = req.nextUrl.searchParams.get("name");
  let brandColor = req.nextUrl.searchParams.get("brandColor");

  return new ImageResponse(
    (
      <div tw="flex flex-col w-full h-full items-center  bg-[#00001e] rounded-xl">
        <div
          tw="flex flex-col w-[80%] h-[69%] items-center  bg-gray-500 rounded-xl transform origin-bottom mt-9 absolute left-7 top-3 pacity-10"
          style={{
            transform: "rotate(357deg)",
          }}></div>
        <div
          tw="flex flex-col w-[90%] h-[69%] items-center  bg-white rounded-xl transform origin-bottom mt-9 absolute top-5 left-8  border-2 opacity-60"
          style={{
            transform: "rotate(358deg)",
          }}></div>
        <div
          tw="flex flex-col w-[91%] h-[67%] items-center  bg-white rounded-xl transform origin-bottom mt-9 absolute top-[2.3rem] left-9"
          style={{
            transform: "rotate(360deg)",
          }}>
          <div tw="flex flex-col w-full">
            <div tw="flex flex-col md:flex-row w-full  md:items-center justify-between ">
              <div tw="flex flex-col  px-8">
                <h2 tw="flex flex-col text-[8] sm:text-4xl font-bold tracking-tight text-gray-900 text-left mt-15">
                  {name}
                </h2>
                <span tw="text-gray-600 text-xl">Complete in ~ 4 minutes</span>
              </div>
            </div>
            <div tw="flex  justify-end mr-10 ">
              <div tw="flex rounded-2xl absolute left-[34.88rem] top-[.35rem]">
                <a
                  tw={`flex items-center justify-center rounded-xl border border-transparent bg-[${brandColor}] px-5 py-3 text-2xl text-white h-15 w-34 font-extrabold opacity-50`}></a>
              </div>
              <div tw="flex rounded-2xl shadow ">
                <a
                  tw={`flex items-center justify-center rounded-xl border border-transparent bg-[${brandColor}] px-5 py-3 text-2xl text-white h-15 w-34 font-extrabold`}>
                  Begin!
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 400,
    }
  );
}
