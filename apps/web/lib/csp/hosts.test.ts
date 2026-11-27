import { describe, expect, test } from "vitest";
import { type TCspHostConfig, getCspHosts } from "./hosts";

const base: TCspHostConfig = {
  webappUrl: "https://app.example.com",
  s3ForcePathStyle: false,
  allowLoopback: false,
};

describe("getCspHosts", () => {
  test("takes the origins of the app's URLs and the Sentry DSN, never their paths or credentials", () => {
    const hosts = getCspHosts({
      ...base,
      publicUrl: "https://surveys.example.com/base",
      assetPrefixUrl: "https://cdn.example.com/formbricks",
      formbricksAppUrl: "https://app.formbricks.com",
      sentryDsn: "https://key@o123.ingest.de.sentry.io/456",
    });

    expect(hosts.appOrigins).toEqual([
      "https://app.example.com",
      "https://surveys.example.com",
      "https://cdn.example.com",
      "https://app.formbricks.com",
    ]);
    expect(hosts.sentryOrigins).toEqual(["https://o123.ingest.de.sentry.io"]);
  });

  test("skips values that are not HTTP(S) URLs", () => {
    const hosts = getCspHosts({ ...base, publicUrl: "not a url", sentryDsn: "javascript:alert(1)" });

    expect(hosts.appOrigins).toEqual(["https://app.example.com"]);
    expect(hosts.sentryOrigins).toEqual([]);
  });

  test("allows a custom S3 endpoint and its virtual-hosted bucket", () => {
    const hosts = getCspHosts({
      ...base,
      s3EndpointUrl: "https://s3.example.com:9000",
      s3BucketName: "uploads",
    });

    expect(hosts.storageOrigins).toEqual([
      "https://s3.example.com:9000",
      "https://uploads.s3.example.com:9000",
    ]);
  });

  test.each(["https://10.0.0.5:9000", "https://[2001:db8::1]:9000", "https://[::1]:9000"])(
    "allows only the endpoint %s when it is an IP address, which takes no bucket subdomain",
    (s3EndpointUrl) => {
      const hosts = getCspHosts({ ...base, s3EndpointUrl, s3BucketName: "uploads", allowLoopback: true });

      expect(hosts.storageOrigins).toEqual([new URL(s3EndpointUrl).origin]);
    }
  );

  test("uses the amazonaws.com.cn domain for AWS China regions", () => {
    const hosts = getCspHosts({ ...base, s3BucketName: "uploads", s3Region: "cn-north-1" });

    expect(hosts.storageOrigins).toEqual([
      "https://uploads.s3.cn-north-1.amazonaws.com.cn",
      "https://s3.cn-north-1.amazonaws.com.cn",
    ]);
  });

  test("allows only the endpoint when path style is forced", () => {
    const hosts = getCspHosts({
      ...base,
      s3EndpointUrl: "https://minio.example.com",
      s3BucketName: "uploads",
      s3ForcePathStyle: true,
    });

    expect(hosts.storageOrigins).toEqual(["https://minio.example.com"]);
  });

  test("allows the AWS bucket when no endpoint is set", () => {
    const hosts = getCspHosts({ ...base, s3BucketName: "uploads", s3Region: "eu-central-1" });

    expect(hosts.storageOrigins).toEqual([
      "https://uploads.s3.eu-central-1.amazonaws.com",
      "https://s3.eu-central-1.amazonaws.com",
    ]);
  });

  test("follows the region the AWS SDK resolves when S3_REGION is not set", () => {
    const hosts = getCspHosts({ ...base, s3BucketName: "uploads", awsSdkRegion: "eu-west-3" });

    expect(hosts.storageOrigins).toEqual([
      "https://uploads.s3.eu-west-3.amazonaws.com",
      "https://s3.eu-west-3.amazonaws.com",
    ]);
  });

  test("prefers S3_REGION over the AWS SDK's region, as the storage client does", () => {
    const hosts = getCspHosts({
      ...base,
      s3BucketName: "uploads",
      s3Region: "us-east-2",
      awsSdkRegion: "eu-west-3",
    });

    expect(hosts.storageOrigins[0]).toBe("https://uploads.s3.us-east-2.amazonaws.com");
  });

  test("allows no storage host when storage is not configured", () => {
    expect(getCspHosts(base).storageOrigins).toEqual([]);
  });

  test("keeps loopback origins out of production builds", () => {
    const hosts = getCspHosts({
      ...base,
      webappUrl: "http://localhost:3000",
      s3EndpointUrl: "http://localhost:9000",
    });

    expect(hosts).toEqual({ appOrigins: [], storageOrigins: [], sentryOrigins: [], loopbackOrigins: [] });
  });

  test("allows local ports and both loopback spellings in development and E2E builds", () => {
    const hosts = getCspHosts({
      ...base,
      webappUrl: "http://localhost:3000",
      s3EndpointUrl: "https://127.0.0.1:9000",
      s3ForcePathStyle: true,
      allowLoopback: true,
    });

    expect(hosts.loopbackOrigins).toEqual([
      "http://localhost:*",
      "http://127.0.0.1:*",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://127.0.0.1:9000",
      "https://localhost:9000",
    ]);
  });
});
