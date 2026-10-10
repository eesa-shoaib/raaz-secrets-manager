import React from 'react';
import { Link } from 'react-router-dom';

interface UserMenuProps {
  email: string
}

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

function UserMenu({ email }: UserMenuProps) {
  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="link link-hover font-heading font-bold px-6 py-2 rounded-2xl transition-colors duration-300 hover:bg-base-300 no-underline text-sm"
      >
        {email}
      </div>
      <ul
        tabIndex={0}
        className="menu menu-md dropdown-content font-ui bg-base-200 rounded-2xl z-10 mt-3 w-56 px-2 py-4 shadow-lg border-base-300 border-2 border-solid "
      >
        <li><a className="hover:bg-base-300" href="/profile">Profile</a></li>
        <li><a className="hover:bg-base-300" href="/settings">Settings</a></li>
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
        <UserMenu email="eesa@gmail.dev" />
      </div>
    </div>
  );
}
