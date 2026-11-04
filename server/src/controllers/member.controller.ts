import type { Request, Response } from 'express';
import { memberResponseSchema } from '@raaz/shared-schemas';
import { addProjectMember, changeProjectMemberRole, listProjectMembers, removeProjectMember } from '../services/membership.service.js';
export async function listMembersController(req: Request, res: Response) { res.json((await listProjectMembers(req.params.projectId)).map((member) => memberResponseSchema.parse(member))); }
export async function addMemberController(req: Request, res: Response) { await addProjectMember(req.user!.id, req.params.projectId, req.body.email, req.body.role); res.status(201).json({ message: 'Member added' }); }
export async function changeMemberRoleController(req: Request, res: Response) { await changeProjectMemberRole(req.user!.id, req.params.projectId, req.params.userId, req.body.role); res.json({ message: 'Member role updated' }); }
export async function removeMemberController(req: Request, res: Response) { await removeProjectMember(req.user!.id, req.params.projectId, req.params.userId); res.json({ message: 'Member removed' }); }
