import mongoose, { type Document } from 'mongoose';

export interface ProjectMembershipDoc extends Document {
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  role: 'projectAdmin' | 'developer' | 'auditor';
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new mongoose.Schema<ProjectMembershipDoc>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    role: { type: String, enum: ['projectAdmin', 'developer', 'auditor'], required: true },
  },
  { timestamps: true }
);

membershipSchema.index({ userId: 1, projectId: 1 }, { unique: true });

export const ProjectMembershipModel = mongoose.model<ProjectMembershipDoc>('ProjectMembership', membershipSchema);