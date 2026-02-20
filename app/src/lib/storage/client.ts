import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs/promises";
import path from "path";

const USE_FS =
  !process.env.S3_ENDPOINT ||
  process.env.S3_ENDPOINT.includes("localhost") ||
  process.env.STORAGE_MODE === "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

const s3 = USE_FS
  ? null
  : new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || "",
      },
      forcePathStyle: true,
    });

const bucket = process.env.S3_BUCKET || "debates";

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  if (USE_FS || !s3) {
    const filePath = path.join(UPLOAD_DIR, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
    return key;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getFileUrl(key: string): Promise<string> {
  if (USE_FS || !s3) {
    // Return a relative path — the caller can serve it or read the buffer
    return `/uploads/${key}`;
  }

  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );
}

export async function getFileBuffer(key: string): Promise<Buffer> {
  if (USE_FS || !s3) {
    const filePath = path.join(UPLOAD_DIR, key);
    return fs.readFile(filePath);
  }

  const response = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  const stream = response.Body;
  if (!stream) throw new Error("No file body");
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
