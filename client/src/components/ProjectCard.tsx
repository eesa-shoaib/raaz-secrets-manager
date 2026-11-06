import type { ProjectResponse } from '@raaz/shared-schemas';
import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from './Badge';

interface ProjectCardProps {
    project: ProjectResponse;
}

export function ProjectCard({ project }: ProjectCardProps) {
    const isArchived = project.status === 'archived';

    const cardContent = (
        <div
            className={`card bg-base-200 border-2 border-solid border-base-300 p-6 rounded-3xl shadow-sm transition-all duration-200 h-full flex flex-col justify-between ${
                isArchived
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
            }`}
        >
            <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-base-300 flex items-center justify-center font-heading font-bold text-lg text-primary border border-base-300">
                            {project.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="font-heading font-bold text-lg text-base-content tracking-tight line-clamp-1">
                                {project.name}
                            </h2>
                        </div>
                    </div>
                    <Badge variant="projectStatus" value={project.status} />
                </div>

                {isArchived ? (
                    <p className="text-xs font-ui text-base-content/70 italic mt-2">
                        Archived — a Platform Admin can restore it.
                    </p>
                ) : null}
            </div>

            <div className="pt-4 mt-4 border-t border-base-300/60 flex items-center justify-between text-xs font-ui text-base-content/70">
                <div className="flex items-center gap-1.5">
                    <span>Role:</span>
                    <Badge variant="role" value={project.role} />
                </div>
                {!isArchived && (
                    <span className="text-primary font-medium flex items-center gap-1 hover:underline">
                        Open
                        <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </span>
                )}
            </div>
        </div>
    );

    if (isArchived) {
        return cardContent;
    }

    return (
        <Link
            to={`/projects/${project.id}/secrets`}
            className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-3xl"
        >
            {cardContent}
        </Link>
    );
}

export default ProjectCard;
