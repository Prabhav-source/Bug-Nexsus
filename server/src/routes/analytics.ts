import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../lib/auth.js';
import { success } from '../lib/errors.js';
import * as analytics from '../services/analyticsService.js';

const router = Router();
router.use(requireAuth);

router.get('/overview', asyncHandler(async (req, res) => {
  res.json(success(await analytics.dashboardOverview(req)));
}));

router.get('/activity', asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days ?? 30), 90);
  res.json(success(await analytics.issueActivityTrend(req, days)));
}));

router.get('/severity-distribution', asyncHandler(async (req, res) => {
  res.json(success(await analytics.severityDistribution(req)));
}));

router.get('/project-health', asyncHandler(async (req, res) => {
  res.json(success(await analytics.projectHealthList(req)));
}));

router.get('/resolution-trends', asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days ?? 30), 90);
  res.json(success(await analytics.resolutionTrends(req, days)));
}));

router.get('/team-workload', asyncHandler(async (req, res) => {
  res.json(success(await analytics.teamWorkload(req)));
}));

router.get('/needs-attention', asyncHandler(async (req, res) => {
  res.json(success(await analytics.needsAttention(req)));
}));

export default router;
