import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { query } from '../database/db.js';

dotenv.config();

const STORAGE_MODE = (process.env.STORAGE_MODE || 'local').toLowerCase();
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || '';
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

if (!['local', 's3'].includes(STORAGE_MODE)) {
  throw new Error('STORAGE_MODE must be either local or s3');
}
if (STORAGE_MODE === 's3' && !AWS_S3_BUCKET) {
  throw new Error('AWS_S3_BUCKET is required when STORAGE_MODE=s3');
}

const s3Client = STORAGE_MODE === 's3'
  ? new S3Client({ region: AWS_REGION })
  : null;
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });

export function calculateSHA256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function validateFile(file) {
  if (!file) throw new Error('No file provided');
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new Error(`Invalid file type '${file.mimetype}'. Allowed types: JPEG, PNG, PDF.`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File size exceeds the 5 MB limit');
  }

  const signature = file.buffer?.subarray(0, 8) || Buffer.alloc(0);
  const validSignature =
    (file.mimetype === 'image/jpeg' && signature[0] === 0xff && signature[1] === 0xd8) ||
    (file.mimetype === 'image/png' && signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4e && signature[3] === 0x47) ||
    (file.mimetype === 'application/pdf' && signature.toString('ascii', 0, 4) === '%PDF');
  if (!validSignature) throw new Error('File content does not match the declared file type');
}

export async function uploadFileToS3({ buffer, originalname, mimetype, size }, listingId, userId) {
  validateFile({ buffer, mimetype, size });
  const extension = path.extname(originalname).toLowerCase() || (mimetype === 'application/pdf' ? '.pdf' : '.bin');
  const objectKey = `listings/${listingId ? String(listingId) : 'general'}/${crypto.randomUUID()}${extension}`;
  const checksum = calculateSHA256(buffer);

  if (STORAGE_MODE === 's3') {
    await s3Client.send(new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: objectKey,
      Body: buffer,
      ContentType: mimetype,
      ServerSideEncryption: 'AES256',
      Metadata: {
        'sha256-checksum': checksum,
        'original-filename': encodeURIComponent(originalname),
        'uploader-id': String(userId)
      }
    }));
  } else {
    saveToLocalStorage(objectKey, buffer);
  }

  const result = await query(`
    INSERT INTO file_uploads
      (listing_id, uploaded_by, original_filename, object_key, content_type, file_size,
       sha256_checksum, storage_backend, upload_status, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', NOW())
  `, [
    listingId ? Number(listingId) : null,
    Number(userId),
    originalname,
    objectKey,
    mimetype,
    size,
    checksum,
    STORAGE_MODE
  ]);

  const fileId = result.insertId;
  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
     VALUES (?, 'FILE_UPLOAD', 'file_uploads', ?, ?)`,
    [Number(userId), process.env.AUDIT_IP || null]
  );

  return {
    id: fileId,
    listingId,
    uploadedBy: userId,
    originalFilename: originalname,
    objectKey,
    contentType: mimetype,
    fileSize: size,
    sha256Checksum: checksum,
    storage: STORAGE_MODE === 's3' ? 'Amazon S3 (SSE-S3 Encrypted)' : 'Local Storage'
  };
}

function localPathFor(objectKey) {
  return path.join(LOCAL_UPLOADS_DIR, objectKey.replace(/[\\/]/g, '_'));
}

function saveToLocalStorage(objectKey, buffer) {
  fs.writeFileSync(localPathFor(objectKey), buffer, { flag: 'wx' });
}

export async function getFileDownloadUrl(objectKey, storageBackend = STORAGE_MODE) {
  if (storageBackend === 's3') {
    const presignedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: AWS_S3_BUCKET, Key: objectKey }),
      { expiresIn: 900 }
    );
    return { url: presignedUrl, isPresignedS3: true };
  }
  return { url: `/api/files/raw/${encodeURIComponent(objectKey)}`, isPresignedS3: false };
}

async function calculateStreamSHA256(stream) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

export async function verifyFileIntegrity(fileId) {
  const rows = await query(`SELECT * FROM file_uploads WHERE id = ?`, [Number(fileId)]);
  if (!rows || rows.length === 0) throw new Error('File metadata not found in database');

  const fileRecord = rows[0];
  const storedChecksum = fileRecord.sha256_checksum;
  const storageBackend = fileRecord.storage_backend || STORAGE_MODE;
  let calculatedChecksum = null;

  try {
    if (storageBackend === 's3') {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: fileRecord.object_key
      }));
      calculatedChecksum = await calculateStreamSHA256(response.Body);
    } else {
      const localPath = localPathFor(fileRecord.object_key);
      if (!fs.existsSync(localPath)) {
        return {
          integrityStatus: 'missing',
          integrity: 'failed',
          fileId: fileRecord.id,
          storedChecksum,
          calculatedChecksum: null,
          verifiedAt: new Date().toISOString()
        };
      }
      calculatedChecksum = await calculateStreamSHA256(fs.createReadStream(localPath));
    }
  } catch (error) {
    const missing = error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404 || error?.code === 'ENOENT';
    return {
      integrityStatus: missing ? 'missing' : 'unavailable',
      integrity: 'failed',
      fileId: fileRecord.id,
      storedChecksum,
      calculatedChecksum: null,
      verifiedAt: new Date().toISOString()
    };
  }

  const integrityStatus = calculatedChecksum === storedChecksum ? 'verified' : 'failed';
  return {
    integrityStatus,
    integrity: integrityStatus,
    algorithm: 'SHA-256',
    fileId: fileRecord.id,
    filename: fileRecord.original_filename,
    objectKey: fileRecord.object_key,
    fileSize: fileRecord.file_size,
    storedChecksum,
    calculatedChecksum,
    recalculatedChecksum: calculatedChecksum,
    verifiedAt: new Date().toISOString()
  };
}

export function getStorageHealth() {
  return {
    storageType: STORAGE_MODE === 's3' ? 'Amazon S3' : 'Local Storage',
    configured: STORAGE_MODE === 'local' || Boolean(s3Client && AWS_S3_BUCKET),
    bucket: AWS_S3_BUCKET || null,
    region: AWS_REGION,
    encryption: STORAGE_MODE === 's3' ? 'SSE-S3 (AES-256)' : 'Filesystem permissions'
  };
}
