import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './Logo';
import { UserAvatar } from './UserAvatar';

export function Navbar() {
    const { user, logout } = useAuth();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        setDropdownOpen(false);
        try {
            await logout();
        } catch {
            // Ignored: auth provider clears state and navigates
        }
    };

    return (
        <header className="sticky top-2 z-40 mx-auto mt-4 w-[calc(100%-2rem)] sm:w-[90%] lg:w-[84%] max-w-7xl rounded-sm border-2 border-solid border-base-300 bg-base-200">
            <div className="mx-auto flex h-24 items-center justify-between gap-2 px-4 sm:px-6">
                {/* Left: Brand + Navigation */}
                <div className="flex items-center gap-6 pl-4 sm:pl-6">
                    <Link
                        to="/projects"
                        className="flex shrink-0 items-center hover:opacity-90 transition-opacity"
                        aria-label="Raaz home"
                    >
                        <Logo className="h-10 w-auto sm:h-12" />
                    </Link>

                    {user && (
                        <nav className="hidden sm:flex items-center gap-1">
                            <NavLink
                                to="/projects"
                                className={({ isActive }) =>
                                    `px-3 py-1.5 rounded-lg text-base font-heading font-medium transition-colors ${
                                        isActive
                                            ? 'bg-base-300 text-base-content font-bold'
                                            : 'text-base-content/70 hover:text-base-content hover:bg-base-300/60'
                                    }`
                                }
                            >
                                Projects
                            </NavLink>
                            {user.isPlatformAdmin && (
                                <NavLink
                                    to="/admin/users"
                                    className={({ isActive }) =>
                                        `px-3 py-1.5 rounded-lg text-base font-heading font-medium transition-colors ${
                                            isActive
                                                ? 'bg-base-300 text-base-content font-bold'
                                                : 'text-base-content/70 hover:text-base-content hover:bg-base-300/60'
                                        }`
                                    }
                                >
                                    Users
                                </NavLink>
                            )}
                        </nav>
                    )}
                </div>

                {/* Right: User Dropdown or Auth Links */}
                <div className="flex items-center gap-3">
                    {user ? (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                onClick={() => setDropdownOpen((prev) => !prev)}
                                className="button-textured group flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-base-300/80 hover:bg-base-300 text-sm font-ui border border-base-300 transition-colors"
                                aria-label={`Account menu for ${user.email}`}
                                aria-expanded={dropdownOpen}
                                aria-haspopup="true"
                            >
                                <UserAvatar
                                    userId={user.id}
                                    email={user.email}
                                    username={user.username}
                                    hasAvatar={user.hasAvatar}
                                    avatarUpdatedAt={user.avatarUpdatedAt}
                                    size="sm"
                                />
                                <span className="hidden max-w-[70px] truncate font-medium text-base-content sm:inline lg:max-w-[140px]">
                                    {user.username || user.email}
                                </span>
                                <svg
                                    className={`w-4 h-4 text-base-content/60 group-hover:text-primary transition-all duration-200 ${dropdownOpen ? 'rotate-180 text-primary' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                    />
                                </svg>
                            </button>

                            {dropdownOpen && (
                                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-base-200 border border-base-300 shadow-2xl py-2 z-50 animate-fade-in font-ui">
                                    <div className="px-1 py-1 space-y-0.5">
                                        <Link
                                            to="/settings"
                                            onClick={() => setDropdownOpen(false)}
                                            className="w-full text-left px-3 py-2 text-sm text-base-content hover:bg-base-300 hover:text-primary rounded-xl transition-colors font-medium flex items-center gap-2 group"
                                        >
                                            <svg
                                                aria-hidden="true"
                                                className="w-4 h-4 text-primary/80 group-hover:text-primary shrink-0"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                            Account Settings
                                        </Link>
                                        {user.isPlatformAdmin && (
                                            <Link
                                                to="/admin/users"
                                                onClick={() => setDropdownOpen(false)}
                                                className="w-full text-left px-3 py-2 text-sm text-base-content hover:bg-base-300 hover:text-primary rounded-xl transition-colors font-medium flex items-center gap-2 group"
                                            >
                                                <svg
                                                    aria-hidden="true"
                                                    className="w-4 h-4 text-primary/80 group-hover:text-primary shrink-0"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                                                    <path d="m9 12 2 2 4-4" />
                                                </svg>
                                                Manage Users
                                            </Link>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleLogout}
                                            className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error/10 rounded-xl transition-colors font-medium flex items-center gap-2"
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                                />
                                            </svg>
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link to="/login" className="btn btn-sm btn-ghost text-sm font-medium">
                                Sign In
                            </Link>
                            <Link
                                to="/signup"
                                className="btn btn-sm btn-primary text-base-300 text-sm font-semibold"
                            >
                                Sign Up
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

export default Navbar;
