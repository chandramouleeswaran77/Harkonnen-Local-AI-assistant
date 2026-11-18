import { Router } from 'express';
import {
  listChats,
  createChat,
  getChat,
  updateChat,
  deleteChat,
  setMessageFeedback,
  switchMessageBranch,
  exportChatMarkdown,
  summarizeChat,
  listFolders,
  createFolder,
  deleteFolder,
} from '../controllers/chatsController.js';

const router = Router();

// Folders
router.get('/folders/list', listFolders);
router.post('/folders', createFolder);
router.delete('/folders/:id', deleteFolder);

// Conversations
router.get('/', listChats);
router.post('/', createChat);
router.get('/:id', getChat);
router.patch('/:id', updateChat);
router.delete('/:id', deleteChat);
router.get('/:id/export', exportChatMarkdown);
router.post('/:id/summarize', summarizeChat);

// Messages feedback & branching
router.patch('/messages/:messageId/feedback', setMessageFeedback);
router.post('/:id/messages/:messageId/activate', switchMessageBranch);

export default router;
