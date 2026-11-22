import { createHash, createHmac } from "node:crypto";

/**
 * Firma AWS Signature Version 4 para la API S3, que es la que habla
 * Cloudflare R2. Se escribe aquí (unas decenas de líneas) en lugar de añadir
 * el SDK de AWS: menos dependencias en el servidor y nada que actualizar.
 * Referencia: https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
 */

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** R2 usa siempre "auto". */
  region: string;
}

export interface SignInput {
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  url: URL;
  /** Cabeceras extra que también se firman (además de host y x-amz-*). */
  headers?: Record<string, string>;
  /** SHA-256 en hex del cuerpo. */
  payloadSha256: string;
  credentials: S3Credentials;
  now: Date;
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** Codificación de URI de AWS: solo A-Z a-z 0-9 - _ . ~ quedan sin escapar. */
export function awsUriEncode(value: string, keepSlash: boolean): string {
  let out = "";
  for (const char of value) {
    if (/[A-Za-z0-9\-_.~]/.test(char) || (keepSlash && char === "/")) {
      out += char;
    } else {
      for (const byte of Buffer.from(char, "utf8")) {
        out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
      }
    }
  }
  return out;
}

function amzDates(now: Date): { amzDate: string; shortDate: string } {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate: iso, shortDate: iso.slice(0, 8) };
}

/** Devuelve las cabeceras que hay que enviar (sin `host`: lo pone fetch). */
export function signS3Request(input: SignInput): Record<string, string> {
  const { amzDate, shortDate } = amzDates(input.now);
  const headers: Record<string, string> = {
    host: input.url.host,
    "x-amz-content-sha256": input.payloadSha256,
    "x-amz-date": amzDate,
  };
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headers[name.toLowerCase()] = value;
  }
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names
    .map((name) => `${name}:${headers[name]!.trim().replace(/\s+/g, " ")}\n`)
    .join("");
  const signedHeaders = names.join(";");

  const query = [...input.url.searchParams.entries()]
    .map(([key, value]) => [awsUriEncode(key, false), awsUriEncode(value, false)] as const)
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const path = awsUriEncode(decodeURIComponent(input.url.pathname), true);

  const canonicalRequest = [
    input.method,
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    input.payloadSha256,
  ].join("\n");
  const scope = `${shortDate}/${input.credentials.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(
      hmac(hmac(`AWS4${input.credentials.secretAccessKey}`, shortDate), input.credentials.region),
      "s3",
    ),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  const { host: _host, ...sent } = headers;
  return {
    ...sent,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
