/**
 * One-off uploader for the home page hero video.
 * Reads public/STRIKERS-new.mp4 and PUTs it to DO Spaces at
 * videos/STRIKERS-new.mp4 with public-read ACL.
 *
 * Run:  node scripts/upload-hero-video.mjs
 *
 * Requires DO_SPACES_* env vars (loaded from .env.local).
 */

import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Minimal .env.local loader (avoids adding dotenv dep)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
try {
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      // Strip surrounding single/double quotes if present
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  }
} catch (err) {
  console.error('Could not read .env.local:', err.message);
  process.exit(1);
}

const {
  DO_SPACES_REGION,
  DO_SPACES_BUCKET,
  DO_SPACES_ENDPOINT,
  DO_SPACES_ACCESS_KEY,
  DO_SPACES_SECRET_KEY,
} = process.env;

if (!DO_SPACES_BUCKET || !DO_SPACES_ENDPOINT || !DO_SPACES_ACCESS_KEY || !DO_SPACES_SECRET_KEY) {
  console.error('Missing DO_SPACES_* env vars in .env.local');
  process.exit(1);
}

const s3 = new S3Client({
  region: DO_SPACES_REGION,
  endpoint: DO_SPACES_ENDPOINT,
  credentials: {
    accessKeyId: DO_SPACES_ACCESS_KEY,
    secretAccessKey: DO_SPACES_SECRET_KEY,
  },
  forcePathStyle: false,
});

const localPath = resolve(__dirname, '..', 'public', 'STRIKERS-new.mp4');
const key = 'videos/STRIKERS-new.mp4';

const stats = statSync(localPath);
console.log(`Uploading ${localPath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
console.log(`  -> s3://${DO_SPACES_BUCKET}/${key}`);

const body = readFileSync(localPath);

await s3.send(new PutObjectCommand({
  Bucket: DO_SPACES_BUCKET,
  Key: key,
  Body: body,
  ContentType: 'video/mp4',
  ACL: 'public-read',
  CacheControl: 'public, max-age=86400',
}));

console.log('Done.');
console.log(`Public URL: ${DO_SPACES_ENDPOINT}/${DO_SPACES_BUCKET}/${key}`);
