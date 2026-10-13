// Kuvatallennus: UpCloud Object Storage (S3-yhteensopiva). Bucket on yksityinen,
// selaimelle annetaan allekirjoitetut (presigned) URL:t.
// Paikallista kehitystä varten STORAGE_DRIVER=local tallentaa levylle, mutta vain
// muualla kuin tuotannossa: Renderin levy ei ole pysyvä.
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const driver = process.env.STORAGE_DRIVER || 's3';
if (driver === 'local' && process.env.NODE_ENV === 'production') {
  throw new Error('STORAGE_DRIVER=local ei ole sallittu tuotannossa');
}

export const LOCAL_DIR = path.resolve(process.env.LOCAL_STORAGE_DIR || '.local-storage');
export const isLocal = driver === 'local';

const s3Configured = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
  .every(k => process.env[k]);
export const storageConfigured = isLocal || s3Configured;

const s3 = s3Configured && !isLocal
  ? new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'europe-1',
      forcePathStyle: true,
      // Uudet oletustarkistussummat (CRC32) eivät ole kaikissa S3-yhteensopivissa palveluissa tuettuja
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    })
  : null;
const Bucket = process.env.S3_BUCKET;

export async function putObject(key, body, contentType = 'image/jpeg') {
  if (isLocal) {
    const file = path.join(LOCAL_DIR, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    return;
  }
  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getObjectBuffer(key) {
  if (isLocal) return fs.readFile(path.join(LOCAL_DIR, key));
  const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function deleteObjects(keys) {
  if (!keys.length) return;
  if (isLocal) {
    await Promise.all(keys.map(k => fs.rm(path.join(LOCAL_DIR, k), { force: true })));
    return;
  }
  // Yksi kerrallaan: UpCloud vaatii DeleteObjects-pyynnöltä Content-MD5:n, jota uusi SDK ei lähetä.
  // Tietokantarivi on jo poistettu, joten epäonnistuminen vain lokitetaan (jää orpo tiedosto).
  const results = await Promise.allSettled(
    keys.map(Key => s3.send(new DeleteObjectCommand({ Bucket, Key })))
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('Tiedoston poisto epäonnistui:', keys[i], r.reason?.message);
  });
}

// Allekirjoitus tehdään päivän alun ajanhetkellä, jolloin URL pysyy samana koko päivän
// ja selain voi välimuistittaa kuvat. Voimassa 2 vrk, eli aina vähintään vuorokauden.
export async function objectUrl(key) {
  if (isLocal) return `/dev-storage/${key}`;
  const signingDate = new Date();
  signingDate.setUTCHours(0, 0, 0, 0);
  return getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), {
    expiresIn: 2 * 24 * 3600,
    signingDate,
  });
}
