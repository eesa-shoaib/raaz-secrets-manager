import {
    createCursorPaginatedResponseSchema,
    memberResponseSchema,
    type ProjectMembersQuery,
} from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import {
    addProjectMember,
    changeProjectMemberRole,
    listProjectMembers,
    listProjectMembersCursor,
    removeProjectMember,
} from '../services/membership.service.js';

const paginatedMembersSchema = createCursorPaginatedResponseSchema(memberResponseSchema);

export async function listMembersController(req: Request, res: Response) {
    const query = req.query as unknown as ProjectMembersQuery;
    if (query.cursor !== undefined || query.mode === 'cursor') {
        const result = await listProjectMembersCursor(req.params.projectId, {
            cursor: query.cursor,
            limit: query.limit,
        });
        res.json(
            paginatedMembersSchema.parse({
                data: result.data.map((member) => memberResponseSchema.parse(member)),
                nextCursor: result.nextCursor,
                hasMore: result.hasMore,
                limit: result.limit,
            }),
        );
        return;
    }
    res.json(
        (await listProjectMembers(req.params.projectId)).map((member) =>
            memberResponseSchema.parse(member),
        ),
    );
}
export async function addMemberController(req: Request, res: Response) {
    await addProjectMember(req.user!.id, req.params.projectId, req.body.email, req.body.role);
    res.status(201).json({ message: 'Member added' });
}
export async function changeMemberRoleController(req: Request, res: Response) {
    await changeProjectMemberRole(
        req.user!.id,
        req.params.projectId,
        req.params.userId,
        req.body.role,
    );
    res.json({ message: 'Member role updated' });
}
export async function removeMemberController(req: Request, res: Response) {
    await removeProjectMember(req.user!.id, req.params.projectId, req.params.userId);
    res.json({ message: 'Member removed' });
}
