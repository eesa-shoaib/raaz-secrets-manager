import React from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Environment } from '../lib/permissions';

const VALID_ENVIRONMENTS: Environment[] = ['development', 'staging', 'production'];

interface EnvironmentTabsProps {
  currentEnvironment: Environment;
  onSelect: (env: Environment) => void;
}

export function EnvironmentTabs({
  currentEnvironment,
  onSelect,
}: EnvironmentTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Environments"
      className="tabs tabs-boxed bg-base-200/80 p-1.5 rounded-2xl inline-flex border border-base-300 gap-1"
    >
      {VALID_ENVIRONMENTS.map((env) => {
        const isActive = currentEnvironment === env;
        const label = env.charAt(0).toUpperCase() + env.slice(1);

        return (
          <button
            key={env}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(env)}
            className={`tab font-heading font-medium text-sm rounded-xl px-4 py-2 transition-all ${
              isActive
                ? 'tab-active bg-primary text-base-300 font-bold shadow-sm'
                : 'text-base-content/70 hover:text-base-content hover:bg-base-300'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default EnvironmentTabs;
