import fs from 'fs';
import path from 'path';
import uuid from 'uuid';
import mime from 'mime-types';
import { Readable } from 'stream';

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
export function save(file: Readable, mimetype: string): string {
  createUploadsDir();

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

  return process.env.API_URL + path.join('/uploads', name);
};
