import { Router } from 'express';
import {
  listModels,
  setActiveModel,
  pullModel,
  deleteModel,
  unloadModel,
  benchmarkModel,
} from '../controllers/modelsController.js';

const router = Router();

router.get('/', listModels);
router.post('/active', setActiveModel);
router.post('/pull', pullModel);
router.post('/unload', unloadModel);
router.post('/benchmark', benchmarkModel);
router.delete('/:name(*)', deleteModel);

export default router;
