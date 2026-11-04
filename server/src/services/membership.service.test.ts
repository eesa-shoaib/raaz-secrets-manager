import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditLogEntryModel } from '../models/AuditLogEntry.js';
import { ProjectModel } from '../models/Project.js';
import { ProjectMembershipModel } from '../models/ProjectMembership.js';
import { UserModel } from '../models/User.js';
import { addProjectMember } from './membership.service.js';

describe('adding a project member', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it.each(['projectAdmin', 'developer'] as const)(
    'updates the admin count only when adding %s, in the same transaction',
    async (role) => {
      const session = { startTransaction: vi.fn(), commitTransaction: vi.fn(), abortTransaction: vi.fn(), endSession: vi.fn() };
      vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as never);
      vi.spyOn(UserModel, 'findOne').mockReturnValue({ lean: async () => ({ _id: new mongoose.Types.ObjectId() }) } as never);
      vi.spyOn(ProjectMembershipModel, 'findOne').mockReturnValue({ lean: async () => null } as never);
      const saveMember = vi.spyOn(ProjectMembershipModel.prototype, 'save').mockResolvedValue({} as never);
      const saveAudit = vi.spyOn(AuditLogEntryModel.prototype, 'save').mockResolvedValue({} as never);
      const update = vi.spyOn(ProjectModel, 'findByIdAndUpdate').mockReturnValue({ exec: async () => ({}) } as never);
      const projectId = new mongoose.Types.ObjectId().toString();
      await addProjectMember(new mongoose.Types.ObjectId().toString(), projectId, 'member@example.com', role);
      expect(saveMember).toHaveBeenCalledWith({ session });
      expect(saveAudit).toHaveBeenCalledWith({ session });
      if (role === 'projectAdmin') expect(update).toHaveBeenCalledWith(projectId, { $inc: { activeAdminCount: 1 } }, { session });
      else expect(update).not.toHaveBeenCalled();
      expect(session.commitTransaction).toHaveBeenCalledOnce();
    },
  );
});
