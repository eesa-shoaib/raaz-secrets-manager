import mongoose, { Types, type ClientSession } from 'mongoose';
import { ProjectMembershipModel, type ProjectMembershipDoc } from '../models/ProjectMembership.js';
import { ProjectModel } from '../models/Project.js';

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
