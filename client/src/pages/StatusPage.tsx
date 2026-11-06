import React from 'react';
import { Link } from 'react-router-dom';

interface StatusPageProps {
    variant: 'not-found' | 'unauthorized';
}

export function StatusPage({ variant }: StatusPageProps) {
    const isNotFound = variant === 'not-found';

    const title = isNotFound ? '404' : '403';
    const heading = isNotFound ? 'Page Not Found' : 'Access Denied';
    const copy = isNotFound
        ? "Page not found. The page you're looking for doesn't exist, or you don't have access to it."
        : "You don't have access to this page.";

    return (
        <div className="page-gutter min-h-screen flex items-center justify-center bg-base-100 text-base-content py-8">
            <div className="card bg-base-200 border border-base-300 p-8 rounded-3xl max-w-md w-full text-center shadow-xl space-y-5">
                <div className="text-6xl font-heading font-extrabold text-primary tracking-tighter">
                    {title}
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-heading font-bold text-base-content">{heading}</h1>
                    <p className="text-sm font-ui text-base-content/70 leading-relaxed">{copy}</p>
                </div>
                <div className="pt-2">
                    <Link
                        to="/projects"
                        className="btn btn-primary text-base-300 font-semibold px-6 rounded-xl hover:opacity-90"
                    >
                        Back to Projects
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default StatusPage;
