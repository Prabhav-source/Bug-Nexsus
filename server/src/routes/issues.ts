import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../lib/auth.js';
import { success } from '../lib/errors.js';
import * as issueService from '../services/issueService.js';

import { createIssueSchema } from '../lib/validation.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  res.json(success(await issueService.listIssues(req)));
}));

router.post('/', validate(createIssueSchema), asyncHandler(async (req, res) => {
  res.status(201).json(success(await issueService.createIssue(req)));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(success(await issueService.getIssue(req, req.params.id)));
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  res.json(success(await issueService.updateIssue(req, req.params.id)));
}));

router.post('/:id/status', asyncHandler(async (req, res) => {
  res.json(success(await issueService.changeIssueStatus(req, req.params.id)));
}));

router.post('/:id/severity', asyncHandler(async (req, res) => {
  res.json(success(await issueService.changeIssueSeverity(req, req.params.id)));
}));

router.post('/:id/assign', asyncHandler(async (req, res) => {
  res.json(success(await issueService.assignIssue(req, req.params.id)));
}));

router.post('/:id/comments', asyncHandler(async (req, res) => {
  res.status(201).json(success(await issueService.addComment(req, req.params.id)));
}));

router.post('/:id/related', asyncHandler(async (req, res) => {
  res.status(201).json(success(await issueService.addRelatedIssue(req, req.params.id)));
}));

router.post('/:id/archive', asyncHandler(async (req, res) => {
  res.json(success(await issueService.archiveIssue(req, req.params.id)));
}));

router.get('/:id/activity', asyncHandler(async (req, res) => {
  res.json(success(await issueService.listIssueActivity(req, req.params.id)));
}));

export default router;
