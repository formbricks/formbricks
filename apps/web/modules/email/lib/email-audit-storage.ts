import "server-only";
import { GenerateMacCommand, KMSClient } from "@aws-sdk/client-kms";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";

const region = "eu-central-1";
const s3 = new S3Client({ region });
const kms = new KMSClient({ region });

export type TEmailAuditSnapshot = Readonly<{ subject: string; html: string; text?: string }>;

export const emailAuditObjectKey = (auditId: string): string => {
  if (!/^[0-9a-f-]{36}$/.test(auditId)) throw new Error("Invalid email audit ID");
  return `email-audit/${auditId}.json`;
};

/** The same address normalization and HMAC key used by the SES bounce collector. */
export const getEmailAuditRecipientMac = async (address: string, keyArn: string): Promise<string> => {
  const result = await kms.send(
    new GenerateMacCommand({
      KeyId: keyArn,
      MacAlgorithm: "HMAC_SHA_256",
      Message: Buffer.from(address.trim().toLowerCase(), "utf8"),
    })
  );
  if (!result.Mac) throw new Error("KMS did not return an email audit recipient MAC");
  return Buffer.from(result.Mac).toString("hex");
};

export const putEmailAuditSnapshot = async (
  bucket: string,
  keyArn: string,
  auditId: string,
  snapshot: TEmailAuditSnapshot
): Promise<{ key: string; sha256: string }> => {
  const key = emailAuditObjectKey(auditId);
  const body = JSON.stringify(snapshot);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: keyArn,
    })
  );
  return { key, sha256: createHash("sha256").update(body).digest("hex") };
};

export const deleteEmailAuditSnapshot = async (bucket: string, auditId: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: emailAuditObjectKey(auditId) }));
};
