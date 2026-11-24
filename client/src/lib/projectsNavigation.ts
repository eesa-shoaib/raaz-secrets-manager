import { z } from 'zod';

const projectsListStateSchema = z.object({
    search: z.string(),
    status: z.enum(['active', 'archived']).optional(),
    cursor: z.string().nullable(),
    cursorHistory: z.array(z.string().nullable()),
});

export type ProjectsListState = z.infer<typeof projectsListStateSchema>;

export const initialProjectsListState: ProjectsListState = {
    search: '',
    cursor: null,
    cursorHistory: [],
};

export function readProjectsListState(state: unknown): ProjectsListState | undefined {
    const result = z.object({ projectsList: projectsListStateSchema }).safeParse(state);
    return result.success ? result.data.projectsList : undefined;
}
