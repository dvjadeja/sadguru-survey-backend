import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../setups/s3';
import { randomBytes } from 'crypto';

const randomString = (length: number) => randomBytes(length).toString('hex');

export const generateUniqueFileName = (fileName?: string) => {
  const ext = fileName?.split('.').pop();

  return `${randomString(8)}.${ext}`;
};

export const getObjectURL = async (key: string) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command);

  return url;
};

export const putObject = async (
  fileName: string,
  contentType: string,
  folderName?: string
) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: folderName ? `${folderName}/${fileName}` : `${fileName}`,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command);

  return url;
};

export const getPublicObjectURL = async (key: string, folder?: string) => {
  if (!key) return null;

  if (folder) {
    return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${folder}/${key}`;
  }

  return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

export const getPathOrFileName = (url: string | URL) => {
  const urlObject = new URL(url);
  const path = urlObject.pathname;
  const parts = path.split('/').filter((part) => part !== ''); // Remove any empty parts

  // Return the full path excluding the initial forward slash
  return parts.join('/');
};
