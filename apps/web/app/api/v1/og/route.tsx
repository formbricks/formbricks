import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const GET = async (req: NextRequest) => {
  let name = req.nextUrl.searchParams.get("name");
  let brandColor = req.nextUrl.searchParams.get("brandColor");
  let timeToFinish = req.nextUrl.searchParams.get("timeToFinish");

  return new ImageResponse(
    (
      <div tw={`flex flex-col w-full h-full items-center  bg-[${brandColor}]/75 rounded-xl `}>
        <div
          tw="flex flex-col w-[80%] h-[60%] bg-white rounded-xl mt-13 absolute left-12 top-3 opacity-20"
          style={{
            transform: "rotate(356deg)",
          }}></div>
        <div
          tw="flex flex-col w-[84%] h-[60%] bg-white rounded-xl mt-12 absolute top-5 left-13  border-2 opacity-60"
          style={{
            transform: "rotate(357deg)",
          }}></div>
        <div
          tw="flex flex-col w-[85%] h-[67%] items-center  bg-white rounded-xl  mt-8 absolute top-[2.3rem] left-14"
          style={{
            transform: "rotate(360deg)",
          }}>
          <div tw="flex flex-col w-full">
            <div tw="flex flex-col md:flex-row w-full md:items-center justify-between ">
              <div tw="flex flex-col  px-8">
                <h2 tw="flex flex-col text-[8] sm:text-4xl font-bold tracking-tight text-slate-900 text-left mt-15">
                  {name}
                </h2>
                {timeToFinish && <span tw="text-slate-600 text-xl">Complete in ~ {timeToFinish}</span>}
              </div>
            </div>
            <div tw="flex justify-end mr-10 ">
              <div tw="flex rounded-2xl absolute -right-2 mt-2">
                <a tw={`rounded-xl border border-transparent bg-[${brandColor}] h-18 w-38 opacity-50`}></a>
              </div>
              <div tw="flex rounded-2xl shadow ">
                <a
                  tw={`flex items-center justify-center rounded-xl border border-transparent bg-[${brandColor}] text-2xl text-white h-18 w-38`}>
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
      headers: {
        "Cache-Control": "public, s-maxage=600, max-age=1800, stale-while-revalidate=600, stale-if-error=600",
      },
    }
  );
};
