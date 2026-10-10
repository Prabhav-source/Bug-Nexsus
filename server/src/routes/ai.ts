import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../lib/auth.js';
import { success } from '../lib/errors.js';
import * as aiService from '../services/aiService.js';
import { aiTextSchema, aiSeveritySchema, aiIssueSchema } from '../lib/validation.js';

const router = Router();
router.use(requireAuth);

router.get('/config', asyncHandler(async (_req, res) => {
  res.json(success(aiService.aiConfig()));
}));

router.post('/summarize', validate(aiIssueSchema), asyncHandler(async (req, res) => {
  res.json(success(await aiService.summarizeIssue(req)));
}));

router.post('/improve', validate(aiTextSchema), asyncHandler(async (req, res) => {
  res.json(success(await aiService.improveText(req)));
}));

router.post('/severity-suggest', validate(aiSeveritySchema), asyncHandler(async (req, res) => {
  res.json(success(await aiService.suggestSeverity(req)));
}));

router.post('/debug-steps', validate(aiIssueSchema), asyncHandler(async (req, res) => {
  res.json(success(await aiService.debugSteps(req)));
}));

router.get('/duplicates/:issueId', asyncHandler(async (req, res) => {
  res.json(success(await aiService.findDuplicates(req, req.params.issueId)));
}));

export default router;
