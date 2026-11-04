import mongoose, { Types, type ClientSession } from 'mongoose';
import { ProjectMembershipModel, type ProjectMembershipDoc } from '../models/ProjectMembership.js';
import { ProjectModel } from '../models/Project.js';
import { AppError } from '../utils/app-error.js';
import { UserModel } from '../models/User.js';
import { writeAuditEntry } from './audit.service.js';

export async function listProjectMembers(projectId: string) {
  const memberships = await ProjectMembershipModel.find({ projectId: new Types.ObjectId(projectId) }).lean();
  const users = await UserModel.find({ _id: { $in: memberships.map((membership) => membership.userId) } }).select('email').lean();
  const emails = new Map(users.map((user) => [user._id.toString(), user.email]));
  return memberships.map((membership) => ({ userId: membership.userId.toString(), email: emails.get(membership.userId.toString()) ?? 'unknown', role: membership.role, createdAt: membership.createdAt }));
}

export async function addProjectMember(actorId: string, projectId: string, email: string, role: 'projectAdmin' | 'developer' | 'auditor') {
  const user = await UserModel.findOne({ email }).lean();
  if (!user) throw new AppError(404, 'NOT_FOUND', 'No account with that email');
  if (await findMembership(user._id.toString(), projectId)) throw new AppError(409, 'CONFLICT', 'Already a member');
  const session = await mongoose.startSession(); session.startTransaction();
  try { await createMembership(user._id.toString(), projectId, role, session); if (role === 'projectAdmin') await incrementAdminCount(projectId, session); await writeAuditEntry({ session, userId: actorId, projectId, targetUserId: user._id.toString(), newRole: role, action: 'member_added', result: 'allowed' }); await session.commitTransaction(); }
  catch (error) { await session.abortTransaction(); throw error; } finally { await session.endSession(); }
}

export async function changeProjectMemberRole(actorId: string, projectId: string, userId: string, role: 'projectAdmin' | 'developer' | 'auditor') {
  const membership = await findMembership(userId, projectId); if (!membership) throw new AppError(404, 'NOT_FOUND', 'Member not found');
  const session = await mongoose.startSession(); session.startTransaction();
  try { if (membership.role === 'projectAdmin' && role !== 'projectAdmin') await removeProjectAdminCount(projectId, session); if (membership.role !== 'projectAdmin' && role === 'projectAdmin') await incrementAdminCount(projectId, session); await updateMembershipRole(userId, projectId, role, session); await writeAuditEntry({ session, userId: actorId, projectId, targetUserId: userId, previousRole: membership.role, newRole: role, action: 'member_role_changed', result: 'allowed' }); await session.commitTransaction(); }
  catch (error) { await session.abortTransaction(); throw error; } finally { await session.endSession(); }
}

export async function removeProjectMember(actorId: string, projectId: string, userId: string) {
  const membership = await findMembership(userId, projectId); if (!membership) throw new AppError(404, 'NOT_FOUND', 'Member not found');
  const session = await mongoose.startSession(); session.startTransaction();
  try { if (membership.role === 'projectAdmin') await removeProjectAdminCount(projectId, session); await deleteMembership(userId, projectId, session); await writeAuditEntry({ session, userId: actorId, projectId, targetUserId: userId, previousRole: membership.role, action: 'member_removed', result: 'allowed' }); await session.commitTransaction(); }
  catch (error) { await session.abortTransaction(); throw error; } finally { await session.endSession(); }
}

export async function findMembership(
  userId: string,
  projectId: string,
): Promise<ProjectMembershipDoc | null> {
  const result = await ProjectMembershipModel.findOne({
    userId: new Types.ObjectId(userId),
    projectId: new Types.ObjectId(projectId),
  }).lean();
  return result as ProjectMembershipDoc | null;
}

export async function getUserRole(
  userId: string,
  projectId: string,
): Promise<'projectAdmin' | 'developer' | 'auditor' | null> {
  const membership = await findMembership(userId, projectId);
  return membership?.role ?? null;
}

export async function createMembership(
  userId: string,
  projectId: string,
  role: 'projectAdmin' | 'developer' | 'auditor',
  session?: ClientSession,
): Promise<ProjectMembershipDoc> {
  const membership = new ProjectMembershipModel({
    userId: new Types.ObjectId(userId),
    projectId: new Types.ObjectId(projectId),
    role,
  });
  return membership.save({ session });
}

export async function updateMembershipRole(
  userId: string,
  projectId: string,
  role: 'projectAdmin' | 'developer' | 'auditor',
  session?: ClientSession,
): Promise<ProjectMembershipDoc | null> {
  const result = await ProjectMembershipModel.findOneAndUpdate(
    { userId: new Types.ObjectId(userId), projectId: new Types.ObjectId(projectId) },
    { $set: { role } },
    { new: true, session },
  ).lean();
  return result as ProjectMembershipDoc | null;
}

export async function deleteMembership(
  userId: string,
  projectId: string,
  session?: ClientSession,
): Promise<void> {
  await ProjectMembershipModel.deleteOne(
    { userId: new Types.ObjectId(userId), projectId: new Types.ObjectId(projectId) },
    { session },
  ).exec();
}

export async function incrementAdminCount(
  projectId: string,
  session?: ClientSession,
): Promise<void> {
  await ProjectModel.findByIdAndUpdate(
    projectId,
    { $inc: { activeAdminCount: 1 } },
    { session },
  ).exec();
}

export async function decrementAdminCount(
  projectId: string,
  session?: ClientSession,
): Promise<void> {
  await ProjectModel.findByIdAndUpdate(
    projectId,
    { $inc: { activeAdminCount: -1 } },
    { session },
  ).exec();
}

export async function removeProjectAdminCount(
  projectId: string,
  session: ClientSession,
): Promise<void> {
  const project = await ProjectModel.findOneAndUpdate(
    { _id: projectId, activeAdminCount: { $gt: 1 } },
    { $inc: { activeAdminCount: -1 } },
    { session },
  ).exec();

  if (!project) {
    throw new AppError(409, 'CONFLICT', 'Cannot remove the last project admin');
  }
}
