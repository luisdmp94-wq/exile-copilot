import { describe, expect, it } from "vitest";
import { awsUriEncode, signS3Request } from "../../server/backup/s3Signature.js";

// Ejemplos publicados por AWS para Signature Version 4 en S3:
// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
const credentials = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
};
const now = new Date("2013-05-24T00:00:00Z");
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("firma S3 (AWS SigV4) para Cloudflare R2", () => {
  it("reproduce el ejemplo oficial de GET con Range", () => {
    const headers = signS3Request({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      headers: { Range: "bytes=0-9" },
      payloadSha256: EMPTY_SHA256,
      credentials,
      now,
    });
    expect(headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, " +
        "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, " +
        "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
    expect(headers["x-amz-date"]).toBe("20130524T000000Z");
    // fetch pone Host por su cuenta: no se envía duplicado.
    expect(headers).not.toHaveProperty("host");
  });

  it("reproduce el ejemplo oficial de listar con parámetros", () => {
    const headers = signS3Request({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J"),
      payloadSha256: EMPTY_SHA256,
      credentials,
      now,
    });
    expect(headers.authorization).toContain(
      "Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7",
    );
  });

  it("codifica como pide AWS (también ! ' ( ) * y espacios)", () => {
    expect(awsUriEncode("a b!'()*~.-_/c", true)).toBe("a%20b%21%27%28%29%2A~.-_/c");
    expect(awsUriEncode("a/b", false)).toBe("a%2Fb");
    expect(awsUriEncode("ñ", false)).toBe("%C3%B1");
  });
});
