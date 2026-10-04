import mongoose, { type Document } from 'mongoose';

export type AuditAction =
  | 'reveal'
  | 'create'
  | 'edit'
  | 'delete'
  | 'member_added'
  | 'member_role_changed'
  | 'member_removed'
  | 'project_created'
  | 'project_renamed'
  | 'project_environments_changed'
  | 'project_archived'
  | 'project_restored'
  | 'user_activated'
  | 'user_deactivated'
  | 'platform_admin_granted'
  | 'platform_admin_revoked'
  | 'bootstrap_admin';

export interface AuditLogEntryDoc extends Document {
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId | null;
  secretId: mongoose.Types.ObjectId | null;
  secretKey: string | null;
  targetUserId: mongoose.Types.ObjectId | null;
  previousRole: 'projectAdmin' | 'developer' | 'auditor' | null;
  newRole: 'projectAdmin' | 'developer' | 'auditor' | null;
  environment: 'development' | 'staging' | 'production' | null;
  action: AuditAction;
  result: 'allowed' | 'denied';
  createdAt: Date;
}

const auditSchema = new mongoose.Schema<AuditLogEntryDoc>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    secretId: { type: mongoose.Schema.Types.ObjectId, ref: 'Secret', default: null },
    secretKey: { type: String, default: null },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    previousRole: { type: String, enum: ['projectAdmin', 'developer', 'auditor'], default: null },
    newRole: { type: String, enum: ['projectAdmin', 'developer', 'auditor'], default: null },
    environment: { type: String, enum: ['development', 'staging', 'production'], default: null },
    action: { type: String, required: true },
    result: { type: String, enum: ['allowed', 'denied'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ projectId: 1, createdAt: -1 });
auditSchema.index({ createdAt: -1 });

export const AuditLogEntryModel = mongoose.model<AuditLogEntryDoc>('AuditLogEntry', auditSchema);
