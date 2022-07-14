import fs from 'fs';
import path from 'path';
import uuid from 'uuid';
import mime from 'mime-types';
import { Readable, PassThrough } from 'stream';
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  s3BucketEndpoint: true,
  endpoint: process.env.AWS_S3_BUCKET_ENDPOINT,
});

const uploadDirPath = process.env.UPLOAD_DIR || 'uploads';

/**
 * Creates upload dir in project root
 */
export function createUploadsDir(): void {
  if (fs.existsSync(uploadDirPath)) {
    return;
  }

  fs.mkdirSync(uploadDirPath);
};


/**
 * Save file to uploads dir
 *
 * @param {Readable} file - ReadStream with file contents
 * @param {string} mimetype - file mimetype
 *
 * @return {string} - url to saved file
 */
export async function save(file: Readable, mimetype: string): Promise<string> {
  // createUploadsDir();

  const extension = mime.extension(mimetype);
  const name = uuid() + '.' + extension;

  const uploadPath = path.join(uploadDirPath, name);

  const writeStream = fs.createWriteStream(uploadPath);

  file.on('readable', () => {
    let chunk: string;

    while ((chunk = file.read()) !== null) {
      writeStream.write(chunk);
    }
  });
  const pass = new PassThrough();

  file.pipe(pass);

  if (process.env.AWS_S3_BUCKET_NAME) {
    await s3.upload({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: name,
      Body: pass,
    }).promise();
  }
  const baseurl = process.env.AWS_S3_BUCKET_BASE_URL || '';
  console.log("uploaded image:", baseurl + '/' + name);

  return baseurl + path.join('/', name);
};
