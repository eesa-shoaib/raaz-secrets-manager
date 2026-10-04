import mongoose, { Types, type ClientSession } from 'mongoose';
import { AuditLogEntryModel, type AuditLogEntryDoc } from '../models/AuditLogEntry.js';

interface WriteAuditEntryParams {
  session?: ClientSession;
  userId: string;
  projectId?: string | null;
  secretId?: string | null;
  secretKey?: string | null;
  targetUserId?: string | null;
  previousRole?: 'projectAdmin' | 'developer' | 'auditor' | null;
  newRole?: 'projectAdmin' | 'developer' | 'auditor' | null;
  environment?: 'development' | 'staging' | 'production' | null;
  action: AuditLogEntryDoc['action'];
  result: 'allowed' | 'denied';
}

export async function writeAuditEntry(params: WriteAuditEntryParams): Promise<void> {
  const entry = new AuditLogEntryModel({
    userId: new Types.ObjectId(params.userId),
    projectId: params.projectId ? new Types.ObjectId(params.projectId) : undefined,
    secretId: params.secretId ? new Types.ObjectId(params.secretId) : undefined,
    secretKey: params.secretKey,
    targetUserId: params.targetUserId ? new Types.ObjectId(params.targetUserId) : undefined,
    previousRole: params.previousRole,
    newRole: params.newRole,
    environment: params.environment,
    action: params.action,
    result: params.result,
  });

  if (params.session) {
    await entry.save({ session: params.session });
  } else {
    await entry.save();
  }
}

export async function writeDeniedAuditEntry(params: Omit<WriteAuditEntryParams, 'result'>): Promise<void> {
  await writeAuditEntry({ ...params, result: 'denied' });
}