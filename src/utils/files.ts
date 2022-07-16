import path from 'path';
import uuid from 'uuid';
import mime from 'mime-types';
import { Readable, PassThrough } from 'stream';
import S3 from 'aws-sdk/clients/s3';

/**
 * Initialize the AWS bucket connection.
 */
let s3Client: S3;

if (process.env.AWS_S3_ACCESS_KEY_ID && process.env.AWS_S3_SECRET_ACCESS_KEY) {
  const s3Config: S3.ClientConfiguration = {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
    s3BucketEndpoint: false,
  };

  if (process.env.AWS_S3_BUCKET_ENDPOINT) {
    s3Config.s3BucketEndpoint = true;
    s3Config.endpoint = process.env.AWS_S3_BUCKET_ENDPOINT;
  }

  s3Client = new S3(s3Config);
} else {
  console.log('\n [Error] [Image upload] Check the AWS S3 bucket environmental variables. \n\n');
}

/**
 * Save file to AWS S3 bucket.
 *
 * @param {Readable} file - ReadStream with file contents
 * @param {string} mimetype - file mimetype
 *
 * @return {Promise<string>} - bucket url of saved file.
 */
export async function save(file: Readable, mimetype: string): Promise<string> {
  /**
   * Return if bucket name, base url and s3 client is not initialized.
   */
  if (!process.env.AWS_S3_BUCKET_NAME) {
    console.log('\n [Error] [Image upload] Check the AWS S3 bucket environmental variables. \n\n');

    return '';
  }
  if (!process.env.AWS_S3_BUCKET_BASE_URL && !s3Client) {
    console.log('\n [Error] [Image upload] Check the AWS S3 bucket environmental variables. \n\n');

    return '';
  }
  const extension = mime.extension(mimetype);
  const name = uuid() + '.' + extension;
  const pass = new PassThrough();

  /**
   * Pipe the readable stream to passthrough stream.
   */
  file.pipe(pass);

  await s3Client.upload({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: name,
    Body: pass,
  }).promise();

  return process.env.AWS_S3_BUCKET_BASE_URL + path.join('/', name);
};
