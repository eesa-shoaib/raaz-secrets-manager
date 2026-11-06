import { Router } from 'express';
import { adminRoutes } from './admin.routes.js';
import { auditRoutes } from './audit.routes.js';
import { authRoutes } from './auth.routes.js';
import { memberRoutes } from './member.routes.js';
import { projectRoutes } from './project.routes.js';
import { secretRoutes } from './secret.routes.js';

export const apiRoutes = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/projects', projectRoutes);
apiRoutes.use('/projects/:projectId/members', memberRoutes);
apiRoutes.use('/projects', secretRoutes);
apiRoutes.use('/projects/:projectId/audit-log', auditRoutes);
apiRoutes.use('/admin', adminRoutes);
