import React from 'react';
import { NavLink } from 'react-router-dom';

export interface TabNavItem {
    to: string;
    label: string;
    visible?: boolean;
}

interface TabNavProps {
    items: TabNavItem[];
    className?: string;
}

export function TabNav({ items, className = '' }: TabNavProps) {
    const visibleItems = items.filter((item) => item.visible !== false);

    return (
        <div
            role="tablist"
            aria-label="Navigation tabs"
            className={`tabs tabs-boxed bg-base-200 p-1.5 rounded-2xl inline-flex border border-base-300 ${className}`}
        >
            {visibleItems.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    role="tab"
                    className={({ isActive }) =>
                        `tab font-heading font-medium text-sm rounded-xl px-5 py-2 transition-all duration-200 ${
                            isActive
                                ? 'tab-active bg-primary text-base-300 font-bold shadow-sm'
                                : 'text-base-content/70 hover:text-base-content hover:bg-base-300'
                        }`
                    }
                >
                    {item.label}
                </NavLink>
            ))}
        </div>
    );
}

export default TabNav;
