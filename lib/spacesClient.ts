/**
 * DigitalOcean Spaces client — S3-compatible storage.
 *
 * Server-side only (uses secret key). Called from API routes.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.DO_SPACES_REGION!;
const bucket = process.env.DO_SPACES_BUCKET!;
const endpoint = process.env.DO_SPACES_ENDPOINT!;

export const s3 = new S3Client({
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.DO_SPACES_ACCESS_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET_KEY!,
  },
  forcePathStyle: false,
});

/**
 * Upload a file buffer to DO Spaces.
 * Returns the public URL on success.
 */
export async function uploadToSpaces(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',
    })
  );
  return getPublicUrl(key);
}

/**
 * Generate a presigned PUT URL so the client can upload directly to DO Spaces.
 * Expires in 10 minutes.
 */
export async function createPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read',
  });
  return getSignedUrl(s3, command, { expiresIn: 600 });
}

/**
 * Delete an object from DO Spaces.
 */
export async function deleteFromSpaces(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * Get the public URL for a stored object.
 */
export function getPublicUrl(key: string): string {
  const cdn = process.env.NEXT_PUBLIC_DO_SPACES_CDN;
  if (cdn) return `${cdn}/${key}`;
  return `${endpoint}/${bucket}/${key}`;
}
