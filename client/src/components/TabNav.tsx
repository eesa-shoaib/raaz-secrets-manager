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
        <nav
            aria-label="Project sections"
            className={`tabs tabs-bordered flex-nowrap overflow-x-auto ${className}`}
        >
            {visibleItems.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                        `tab h-11 whitespace-nowrap border-b-2 px-5 font-heading text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                            isActive
                                ? 'tab-active !border-primary !text-primary font-bold'
                                : 'border-transparent text-base-content/70 hover:text-base-content'
                        }`
                    }
                >
                    {item.label}
                </NavLink>
            ))}
        </nav>
    );
}

export default TabNav;
