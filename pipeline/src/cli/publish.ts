import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { publishDirectory, type ObjectStore } from '../publish';
import { OUT_DIR } from './paths';

const version = process.env.TILESET_VERSION;
const bucket = process.env.S3_BUCKET ?? 'turismo';
if (!version) {
  console.error('Set TILESET_VERSION to the folder under out/ to publish');
  process.exit(1);
}

const client = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
  forcePathStyle: process.env.S3_PATH_STYLE !== 'false',
  credentials: { accessKeyId: process.env.S3_KEY ?? 'turismo', secretAccessKey: process.env.S3_SECRET ?? 'turismo-secret' },
});

const store: ObjectStore = {
  async put(key, body, contentType, cacheControl) {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl, ACL: 'public-read' }));
  },
};

const prefix = `tiles/${version}`;
const result = await publishDirectory(store, `${OUT_DIR}${version}`, prefix, { concurrency: 8, retries: 3 });
const publicBase = process.env.PUBLIC_BASE ?? `${process.env.S3_ENDPOINT ?? ''}/${bucket}`;
console.log(`Published ${result.files} files (${(result.bytes / 1024 / 1024).toFixed(1)} MB).`);
console.log(`Register it with: php artisan tilesets:register ${version} ${publicBase}/${prefix}/`);
