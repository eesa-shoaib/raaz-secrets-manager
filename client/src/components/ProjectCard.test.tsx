import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectCard } from './ProjectCard';

describe('project card', () => {
    afterEach(cleanup);
    it('links to an active project without displaying its environments', () => {
        render(
            <MemoryRouter>
                <ProjectCard
                    project={{
                        id: 'project-id',
                        name: 'Example',
                        environments: ['development', 'staging', 'production'],
                        status: 'active',
                        role: 'developer',
                        createdBy: 'user-id',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }}
                />
            </MemoryRouter>,
        );
        expect(screen.getByRole('link').getAttribute('href')).toBe('/projects/project-id/secrets');
        expect(screen.queryByText('development')).toBeNull();
        expect(screen.queryByText('staging')).toBeNull();
        expect(screen.queryByText('production')).toBeNull();
    });
});
