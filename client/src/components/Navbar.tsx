import React from 'react';
import { Link } from 'react-router-dom';

function NavbarStyle({
  children,
  to,
  className,
}: {
  children: React.ReactNode;
  to: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`link link-hover font-heading font-bold px-6 py-2 rounded-2xl transition-colors duration-300 hover:bg-base-300 no-underline ${className}`}
    >
      {children}
    </Link>
  );
}

function UserMenu() {
  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar placeholder">
        <div className="bg-neutral text-neutral-content w-10 rounded-full">
          <span className="text-sm font-heading font-semibold">RA</span>
        </div>
      </div>
      <ul
        tabIndex={0}
        className="menu menu-sm dropdown-content font-heading bg-base-100 rounded-box z-10 mt-3 w-52 p-2 shadow"
      >
        <div className="font-ui px-2 text-center">
          <span className="text-base-content font-medium normal-case">you@example.com</span>
          <li>
            <a href="/">Profile</a>
          </li>
          <li>
            <a href="#">Settings</a>
          </li>
        </div>
      </ul>
    </div>
  );
}

export default function NavBar() {
  return (
    <div className="navbar bg-base-200 shadow-xl border-base-300 border-2 border-solid max-w-6xl mx-auto px-8 py-4">
      <div className="navbar-start flex items-center gap-6">
        <NavbarStyle to="/" className="text-xl">
          Raaz App
        </NavbarStyle>
        <NavbarStyle to="project" className="text-lg">
          Projects
        </NavbarStyle>
      </div>
      <div className="navbar-end flex items-center gap-6">
        <UserMenu />
      </div>
    </div>
  );
}
