import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { describe, expect, test } from "vitest";

/**
 * ENG-3263 regression guard for a dependency pin rather than for local code.
 *
 * `deleteFilesByPrefix` pages through `ListObjectsV2`, so it only works if the AWS SDK can
 * deserialize an XML response. The SDK parses XML with `fast-xml-parser` and registers `#xD` and
 * `#10` as entities on its parser; `fast-xml-parser` 5.7.0 and 5.7.1 reject entity names beginning
 * with `#`, so every XML-parsed S3 response threw — on any backend, AWS included. The request
 * succeeded (HTTP 200) and deserialization failed, which storage cleanup logs and swallows, so
 * workspace deletion silently left every uploaded file in the bucket.
 *
 * Nothing caught it: every storage suite mocks the S3 client or `@formbricks/storage` outright, so
 * no test ever parsed a real response. This one drives the SDK's own deserializer over a canned
 * body — no bucket, no network — and fails if the pinned parser cannot handle it.
 */
const LIST_OBJECTS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>formbricks</Name><Prefix>ws-1</Prefix><MaxKeys>1000</MaxKeys><KeyCount>2</KeyCount><IsTruncated>false</IsTruncated><Contents><Key>ws-1/public/logo.png</Key><LastModified>2026-09-17T12:55:49.752Z</LastModified><Size>5</Size><StorageClass>STANDARD</StorageClass></Contents><Contents><Key>ws-1/private/line&#xD;break.pdf</Key><LastModified>2026-09-17T12:55:49.752Z</LastModified><Size>7</Size><StorageClass>STANDARD</StorageClass></Contents></ListBucketResult>`;

// Returns the canned body straight from the request handler, so the SDK's deserializer runs for
// real while nothing leaves the process. A Uint8Array body is collected without a stream collector.
const cannedXmlHandler = (xml: string) => ({
  handle: () =>
    Promise.resolve({
      response: {
        statusCode: 200,
        reason: "OK",
        headers: { "content-type": "application/xml" },
        body: new TextEncoder().encode(xml),
      },
    }),
});

describe("AWS SDK XML deserialization", () => {
  const client = new S3Client({
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    requestHandler: cannedXmlHandler(LIST_OBJECTS_XML) as never,
  });

  test("deserializes a ListObjectsV2 response with the pinned fast-xml-parser", async () => {
    const output = await client.send(new ListObjectsV2Command({ Bucket: "formbricks", Prefix: "ws-1" }));

    expect(output.KeyCount).toBe(2);
    expect(output.Contents?.map((object) => object.Key)).toEqual([
      "ws-1/public/logo.png",
      // `&#xD;` is the entity the SDK registers and 5.7.0/5.7.1 refused to accept; asserting the
      // decoded value proves the mapping survives, not just that parsing did not throw.
      "ws-1/private/line\rbreak.pdf",
    ]);
  });
});
