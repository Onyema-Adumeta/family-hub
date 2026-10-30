// Photo and video uploads.
//
// With Cloudinary configured (production), files go to Cloudinary and the
// returned URL is permanent. Without it (local development), files are saved
// to UPLOAD_DIR and served from /uploads. Don't rely on that in production:
// Railway's disk is wiped on every deploy.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

export const cloudinaryConfigured = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

let configured = false;
function setup() {
  if (configured || !cloudinaryConfigured()) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

/** Multer middleware for one file in `field`, stored in Cloudinary `folder` (or locally in development). */
export function uploader(opts: { folder: string; field: string; videos: boolean; maxMb: number }) {
  setup();
  const allowed = opts.videos ? [...IMAGE_TYPES, ...VIDEO_TYPES] : IMAGE_TYPES;
  const storage = cloudinaryConfigured()
    ? new CloudinaryStorage({
        cloudinary,
        params: (async (_req: any, file: Express.Multer.File) => ({
          folder: `family-hub/${opts.folder}`,
          resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
          // iPhone photos are HEIC, which most browsers can't show; store them as JPEG.
          ...(/hei[cf]/.test(file.mimetype) ? { format: 'jpg' } : {}),
        })) as any,
      })
    : multer.diskStorage({
        destination: (_req, _file, cb) => { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); cb(null, UPLOAD_DIR); },
        // Random names: local files are served without a sign-in check, so they must not be guessable.
        filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase().slice(0, 6)),
      });
  return multer({
    storage,
    limits: { fileSize: opts.maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, allowed.includes(file.mimetype)),
  }).single(opts.field);
}

/** The URL to store for an uploaded file. */
export function uploadedUrl(file: Express.Multer.File): string {
  return cloudinaryConfigured() ? (file as any).path : `/uploads/${file.filename}`;
}
