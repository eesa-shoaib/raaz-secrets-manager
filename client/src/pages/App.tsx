import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LoginPage from './LoginPage';
import ProjectsPage from './ProjectsPage';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <main className="max-w-6xl mx-auto px-8 py-8">{children}</main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/project" element={<ProjectsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
