import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { getFileFromS3, getSignedUrlForUpload } from "@formbricks/lib/services/storage";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const fileName = searchParams.get("fileName");

  if (!fileName) {
    return NextResponse.json(
      {
        success: false,
        message: "Missing required parameters",
      },
      {
        status: 400,
      }
    );
  }

  // parse the fileName to get the environmentId and accessType
  const fileNameParts = fileName.split("/");
  const environmentId = fileNameParts[0];
  const accessType = fileNameParts[1];

  if (!environmentId || !accessType) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid file name",
      },
      {
        status: 400,
      }
    );
  }

  if (accessType === "public") {
    try {
      const { fileBuffer, metaData } = await getFileFromS3(fileName);

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": metaData.contentType,
          "Content-Disposition": "inline",
        },
      });
    } catch (err) {
      if (err.name === "NoSuchKey") {
        return NextResponse.json(
          {
            success: false,
            message: "File not found",
          },
          {
            status: 404,
          }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            message: "Internal server error",
          },
          {
            status: 500,
          }
        );
      }
    }
  }

  if (accessType !== "private") {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid access type",
      },
      {
        status: 400,
      }
    );
  }

  // auth and download private file

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user, environmentId);

  if (!isUserAuthorized) {
    return NextResponse.json(
      {
        success: false,
        message: "Forbidden",
      },
      {
        status: 403,
      }
    );
  }

  try {
    const { fileBuffer, metaData } = await getFileFromS3(fileName);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": metaData.contentType,
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    if (err.name === "NoSuchKey") {
      return NextResponse.json(
        {
          success: false,
          message: "File not found",
        },
        {
          status: 404,
        }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Internal server error",
        },
        {
          status: 500,
        }
      );
    }
  }
}

export async function POST(req: NextRequest) {
  const { fileName, fileType, accessType = "private", environmentId } = await req.json();

  if (!fileName || !fileType || !environmentId) {
    return NextResponse.json(
      {
        success: false,
        message: "Missing required parameters",
      },
      {
        status: 400,
      }
    );
  }

  if (accessType === "public") {
    // dont auth and upload public file

    const signedUrl = await getSignedUrlForUpload(`${environmentId}/${accessType}/${fileName}`, fileType);

    return NextResponse.json(
      {
        success: true,
        signedUrl,
      },
      {
        status: 200,
      }
    );
  }

  if (accessType !== "private") {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid access type",
      },
      {
        status: 400,
      }
    );
  }

  // auth and upload private file

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user, environmentId);

  if (!isUserAuthorized) {
    return NextResponse.json(
      {
        success: false,
        message: "Forbidden",
      },
      {
        status: 403,
      }
    );
  }

  const signedUrl = await getSignedUrlForUpload(`${environmentId}/${accessType}/${fileName}`, fileType);

  return NextResponse.json(
    {
      success: true,
      signedUrl,
    },
    {
      status: 200,
    }
  );
}
