import type { ClientSession } from 'mongoose';
import { ProjectModel } from '../models/Project.js';
import { AppError } from '../utils/app-error.js';

// Share the project's write lock with deletion so late inserts cannot leave orphan records.
export async function lockActiveProject(projectId: string, session: ClientSession) {
    const project = await ProjectModel.findOneAndUpdate(
        { _id: projectId, status: 'active' },
        { $inc: { __v: 1 } },
        { session, timestamps: false },
    );
    if (!project) throw new AppError(409, 'CONFLICT', 'Project is no longer available for changes');
}
