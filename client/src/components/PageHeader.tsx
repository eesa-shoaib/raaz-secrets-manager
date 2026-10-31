import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 mb-6 border-b border-base-300 ${className}`}>
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-base-content tracking-tight">
          {title}
        </h1>
        {description && (
          <div className="text-sm font-ui text-base-content/70 mt-1">
            {description}
          </div>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  );
}

export default PageHeader;
