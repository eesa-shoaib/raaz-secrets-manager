import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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
    <header className="w-full bg-base-200 border-b border-base-300/80 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand + Navigation */}
        <div className="flex items-center gap-6">
          <Link
            to="/projects"
            className="flex items-center gap-2.5 font-heading font-bold text-xl text-primary tracking-tight hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-mono font-black text-lg border border-primary/30">
              R
            </div>
            <span>Raaz</span>
          </Link>

          {user && (
            <nav className="hidden sm:flex items-center gap-1">
              <NavLink
                to="/projects"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-heading font-medium transition-colors ${
                    isActive
                      ? 'bg-base-300 text-base-content font-bold'
                      : 'text-base-content/70 hover:text-base-content hover:bg-base-300/60'
                  }`
                }
              >
                Projects
              </NavLink>
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
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-base-300/80 hover:bg-base-300 text-sm font-ui border border-base-300 transition-colors"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase">
                  {user.email.charAt(0)}
                </div>
                <span className="font-medium text-base-content max-w-[180px] truncate">
                  {user.email}
                </span>
                <svg
                  className={`w-4 h-4 text-base-content/60 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-base-200 border border-base-300 shadow-2xl py-2 z-50 animate-fade-in font-ui">
                  <div className="px-4 py-2 border-b border-base-300">
                    <p className="text-xs text-base-content/60">Signed in as</p>
                    <p className="text-sm font-semibold text-base-content truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>
                  <div className="px-1 py-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error/10 rounded-xl transition-colors font-medium flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
              <Link to="/signup" className="btn btn-sm btn-primary text-base-300 text-sm font-semibold">
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
