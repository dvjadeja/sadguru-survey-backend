import { S3Client } from '@aws-sdk/client-s3';

if (
  !process.env.AWS_S3_BUCKET_NAME ||
  !process.env.AWS_REGION ||
  !process.env.AWS_S3_ACCESS_KEY ||
  !process.env.AWS_S3_SECRET_KEY
) {
  console.log(
    '[MISSING ENV] AWS_S3_BUCKET_NAME, AWS_REGION, AWS_S3_ACCESS_KEY, AWS_S3_SECRET_KEY'
  );
  process.exit(1);
}

export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY,
    secretAccessKey: process.env.AWS_S3_SECRET_KEY,
  },
});
