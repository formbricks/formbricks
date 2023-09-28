import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getFileFromLocalStorage,
  getFileFromS3,
  putFileToLocalStorage,
  putFileToS3,
} from "@formbricks/lib/services/storage";
import path from "path";

const UPLOADS_DIR = path.resolve("./uploads");

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
  const baseFileName = fileNameParts[2];

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

  const getFile = async () => {
    if (
      !process.env.AWS_ACCESS_KEY ||
      !process.env.AWS_SECRET_KEY ||
      !process.env.S3_REGION ||
      !process.env.S3_BUCKET_NAME
    ) {
      try {
        const { fileBuffer, metaData } = await getFileFromLocalStorage(
          path.join(UPLOADS_DIR, environmentId, accessType, baseFileName)
        );

        return new Response(fileBuffer, {
          headers: {
            "Content-Type": metaData.contentType,
            "Content-Disposition": "inline",
          },
        });
      } catch (err) {
        return NextResponse.json(
          {
            success: false,
            message: "File not found",
          },
          {
            status: 404,
          }
        );
      }
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
  };

  if (accessType === "public") {
    return await getFile();
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

  return await getFile();
}

export async function POST(req: NextRequest) {
  const { fileName, fileType, accessType = "private", environmentId, fileBuffer } = await req.json();

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

  // check file size and if it is greater than 10MB, return error

  const uploadFile = async () => {
    // if s3 is not configured, we'll upload to a local folder named uploads

    if (
      !process.env.AWS_ACCESS_KEY ||
      !process.env.AWS_SECRET_KEY ||
      !process.env.S3_REGION ||
      !process.env.S3_BUCKET_NAME
    ) {
      try {
        await putFileToLocalStorage(fileName, fileBuffer, accessType, environmentId, UPLOADS_DIR);

        return NextResponse.json(
          {
            success: true,
            message: "File uploaded successfully",
          },
          {
            status: 201,
          }
        );
      } catch (err) {
        if (err.name === "FileTooLargeError") {
          return NextResponse.json(
            {
              success: false,
              message: err.message,
            },
            {
              status: 400,
            }
          );
        }

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

    try {
      await putFileToS3(fileName, fileType, fileBuffer, accessType, environmentId);

      return NextResponse.json(
        {
          success: true,
          message: "File uploaded successfully",
        },
        {
          status: 201,
        }
      );
    } catch (err) {
      if (err.name === "FileTooLargeError") {
        return NextResponse.json(
          {
            success: false,
            message: err.message,
          },
          {
            status: 400,
          }
        );
      }

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
  };

  if (accessType === "public") {
    // dont auth and upload public file
    return await uploadFile();
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

  return await uploadFile();
}
