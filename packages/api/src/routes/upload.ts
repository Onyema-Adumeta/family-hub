import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { uploader, uploadedUrl } from '../services/media';

const router = Router();

// POST /api/upload — a photo or short video for chat or chore proof (any signed-in member)
const upload = uploader({ folder: 'uploads', field: 'file', videos: true, maxMb: 25 });

router.post('/', (req, res, next) => {
  upload(req, res, (err: any) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'That file is too big (25 MB at most).' });
    if (err) { console.error('upload failed', err); return res.status(500).json({ error: 'Could not upload the file. Please try again.' }); }
    next();
  });
}, async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a photo or video (JPEG, PNG, WebP, GIF, HEIC, MP4, MOV or WebM).' });
  const isVideo = req.file.mimetype.startsWith('video/');
  res.json({ url: uploadedUrl(req.file), type: isVideo ? 'video' : 'image' });
});

export default router;
