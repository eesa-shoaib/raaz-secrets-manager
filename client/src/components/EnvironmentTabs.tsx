import React from 'react';
import type { Environment } from '../lib/permissions';

const VALID_ENVIRONMENTS: Environment[] = ['development', 'staging', 'production'];

interface EnvironmentTabsProps {
    currentEnvironment: Environment;
    onSelect: (env: Environment) => void;
}

export function EnvironmentTabs({ currentEnvironment, onSelect }: EnvironmentTabsProps) {
    return (
        <div className="flex flex-col items-start gap-2">
            <span className="font-ui text-xs font-semibold uppercase tracking-wider text-base-content/60">
                Environment
            </span>
            <div
                role="group"
                aria-label="Environment"
                className="join max-w-full overflow-x-auto rounded-xl border border-base-300 bg-base-200"
            >
                {VALID_ENVIRONMENTS.map((env) => {
                    const isActive = currentEnvironment === env;
                    const label = env.charAt(0).toUpperCase() + env.slice(1);

                    return (
                        <button
                            key={env}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => onSelect(env)}
                            className={`btn btn-sm join-item h-10 min-h-10 whitespace-nowrap border-0 px-4 font-ui text-sm font-medium shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                                isActive
                                    ? 'bg-base-300 text-primary font-bold hover:bg-base-300'
                                    : 'bg-transparent text-base-content/70 hover:bg-base-300/60 hover:text-base-content'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default EnvironmentTabs;
