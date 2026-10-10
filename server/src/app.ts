import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getEnv } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import projectRoutes from './routes/projects.js';
import issueRoutes from './routes/issues.js';
import sprintRoutes from './routes/sprints.js';
import developerRoutes from './routes/developers.js';
import activityRoutes from './routes/activity.js';
import notificationRoutes from './routes/notifications.js';
import analyticsRoutes from './routes/analytics.js';
import searchRoutes from './routes/search.js';
import labelRoutes from './routes/labels.js';
import aiRoutes from './routes/ai.js';

export function createApp() {
  const env = getEnv();
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", env.CLIENT_URL],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      },
    },
  }));

  app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id'],
  }));

  app.use(express.json({ limit: '1mb' }));

  const authLimiter = rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/issues', issueRoutes);
  app.use('/api/sprints', sprintRoutes);
  app.use('/api/developers', developerRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/labels', labelRoutes);
  app.use('/api/ai', aiRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.use(errorHandler);

  return app;
}
