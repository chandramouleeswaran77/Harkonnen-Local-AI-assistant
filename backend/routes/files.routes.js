import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config.js';
import { uploadFile, listFiles, deleteFile, searchFiles } from '../controllers/filesController.js';

fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CONFIG.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: CONFIG.MAX_UPLOAD_SIZE_BYTES },
});

const router = Router();

router.post('/upload', upload.single('file'), uploadFile);
router.get('/', listFiles);
router.post('/search', searchFiles);
router.delete('/:id', deleteFile);

export default router;
