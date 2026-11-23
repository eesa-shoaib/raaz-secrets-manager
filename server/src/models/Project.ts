import type { GitHubRepositorySource } from '@raaz/shared-schemas';
import mongoose, { type Document } from 'mongoose';

export interface ProjectDoc extends Document {
    name: string;
    githubRepository?: GitHubRepositorySource | null;
    description: string;
    environments: ('development' | 'staging' | 'production')[];
    activeAdminCount: number;
    status: 'active' | 'archived';
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const projectSchema = new mongoose.Schema<ProjectDoc>(
    {
        githubRepository: {
            type: new mongoose.Schema(
                { id: Number, owner: String, name: String, url: String },
                { _id: false },
            ),
            default: null,
        },
        name: { type: String, required: true, maxlength: 100 },
        description: { type: String, default: '', maxlength: 500 },
        environments: {
            type: [String],
            enum: ['development', 'staging', 'production'],
            required: true,
        },
        activeAdminCount: { type: Number, required: true, default: 1 },
        status: { type: String, enum: ['active', 'archived'], required: true, default: 'active' },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true },
);

projectSchema.index({ createdAt: -1, _id: -1 });
projectSchema.index(
    { createdBy: 1, 'githubRepository.id': 1 },
    { unique: true, partialFilterExpression: { 'githubRepository.id': { $type: 'number' } } },
);

export const ProjectModel = mongoose.model<ProjectDoc>('Project', projectSchema);
