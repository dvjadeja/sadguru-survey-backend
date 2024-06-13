import { Request, Response } from 'express';
import { s3Client } from '../setups/s3';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import {
  generateUniqueFileName,
  getPathOrFileName,
  getPublicObjectURL,
} from '../utils/s3.utils';

export const uploadFile = async (req: Request, res: Response) => {
  const uniqueFilename = generateUniqueFileName(req?.file?.originalname);
  const command = new PutObjectCommand({
    Bucket: `${process.env.AWS_S3_BUCKET_NAME}`,
    Key: `${req?.file?.fieldname}/${uniqueFilename}`, // uniqueFilename,
    Body: req?.file?.buffer,
    ContentType: req?.file?.mimetype,
  });

  try {
    const response = await s3Client.send(command);

    if (!response) throw new Error('Error while uploading file');

    const url = await getPublicObjectURL(uniqueFilename, req?.file?.fieldname);

    handleSuccess(res, {
      message: 'File uploaded successfully',
      data: { url },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while uploading file',
      error,
    });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  const key = getPathOrFileName(req?.body?.url);

  const command = new DeleteObjectCommand({
    Bucket: `${process.env.AWS_S3_BUCKET_NAME}`,
    Key: `${key}`, // uniqueFilename,
  });

  try {
    const response = await s3Client.send(command);

    if (!response) throw new Error('Error while deleting file');

    handleSuccess(res, {
      message: 'File deleted successfully',
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while deleting file',
      error,
    });
  }
};
