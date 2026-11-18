import { Router } from 'express';
import {
  getHealth,
  getSystemResources,
  getSettings,
  updateSettings,
  getUsageAnalytics,
} from '../controllers/systemController.js';
import { PERSONALITIES } from '../services/personalities.js';

const router = Router();

router.get('/health', getHealth);
router.get('/system/resources', getSystemResources);
router.get('/system/settings', getSettings);
router.patch('/system/settings', updateSettings);
router.get('/system/analytics', getUsageAnalytics);
router.get('/system/personalities', (_req, res) => {
  res.json({ personalities: Object.values(PERSONALITIES) });
});

export default router;
