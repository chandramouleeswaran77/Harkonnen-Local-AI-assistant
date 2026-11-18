import { Router } from 'express';
import { handleStreamChat, handleStopGeneration } from '../controllers/chatController.js';

const router = Router();

router.post('/', handleStreamChat);
router.post('/stop', handleStopGeneration);

export default router;
