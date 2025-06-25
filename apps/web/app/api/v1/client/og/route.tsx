import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const GET = async (req: NextRequest) => {
  let name = req.nextUrl.searchParams.get("name");
  let brandColor = req.nextUrl.searchParams.get("brandColor");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          alignItems: "center",
          backgroundColor: brandColor ? brandColor + "BF" : "#0000BFBF", // /75 opacity is approximately BF in hex
          borderRadius: "0.75rem",
        }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "80%",
            height: "60%",
            backgroundColor: "white",
            borderRadius: "0.75rem",
            marginTop: "3.25rem",
            position: "absolute",
            left: "3rem",
            top: "0.75rem",
            opacity: 0.2,
            transform: "rotate(356deg)",
          }}></div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "84%",
            height: "60%",
            backgroundColor: "white",
            borderRadius: "0.75rem",
            marginTop: "3rem",
            position: "absolute",
            top: "1.25rem",
            left: "3.25rem",
            borderWidth: "2px",
            opacity: 0.6,
            transform: "rotate(357deg)",
          }}></div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "85%",
            height: "67%",
            alignItems: "center",
            backgroundColor: "white",
            borderRadius: "0.75rem",
            marginTop: "2rem",
            position: "absolute",
            top: "2.3rem",
            left: "3.5rem",
            transform: "rotate(360deg)",
          }}>
          <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                justifyContent: "space-between",
              }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  paddingLeft: "2rem",
                  paddingRight: "2rem",
                }}>
                <h2
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    fontSize: "2rem",
                    fontWeight: "700",
                    letterSpacing: "-0.025em",
                    color: "#0f172a",
                    textAlign: "left",
                    marginTop: "3.75rem",
                  }}>
                  {name}
                </h2>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginRight: "2.5rem" }}>
              <div
                style={{
                  display: "flex",
                  borderRadius: "1rem",
                  position: "absolute",
                  right: "-0.5rem",
                  marginTop: "0.5rem",
                }}>
                <div
                  content=""
                  style={{
                    borderRadius: "0.75rem",
                    border: "1px solid transparent",
                    backgroundColor: brandColor ?? "#000",
                    height: "4.5rem",
                    width: "9.5rem",
                    opacity: 0.5,
                  }}></div>
              </div>
              <div
                style={{
                  display: "flex",
                  borderRadius: "1rem",
                  boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
                }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "0.75rem",
                    border: "1px solid transparent",
                    backgroundColor: brandColor ?? "#000",
                    fontSize: "1.5rem",
                    color: "white",
                    height: "4.5rem",
                    width: "9.5rem",
                  }}>
                  Begin!
                </div>
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
