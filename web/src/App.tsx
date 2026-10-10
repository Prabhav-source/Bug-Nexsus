import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { setUnauthorizedHandler } from './api/client';
import AppShell from './layout/AppShell';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Issues from './pages/Issues';
import IssueDetail from './pages/IssueDetail';
import NewIssue from './pages/NewIssue';
import Board from './pages/Board';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Sprints from './pages/Sprints';
import Developers from './pages/Developers';
import Analytics from './pages/Analytics';
import Activity from './pages/Activity';
import Settings from './pages/Settings';
import { Hexagon } from 'lucide-react';
import { Card } from './components/ui';

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2.5">
          <span className="text-primary">
            <Hexagon size={32} strokeWidth={2.2} fill="currentColor" fillOpacity={0.15} />
          </span>
          <span className="text-sm text-text-muted">Loading BugNexus…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default function App() {
  const { token } = useAuth();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      window.dispatchEvent(new CustomEvent('bugnexus:unauthorized'));
    });

    const handler = () => {
      window.location.href = '/login';
    };
    window.addEventListener('bugnexus:unauthorized', handler);
    return () => window.removeEventListener('bugnexus:unauthorized', handler);
  }, []);

  const shellRoutes = (
    <Route element={<AppShell />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/issues" element={<Issues />} />
      <Route path="/issues/new" element={<NewIssue />} />
      <Route path="/issues/:id" element={<IssueDetail />} />
      <Route path="/board" element={<Board />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/sprints" element={<Sprints />} />
      <Route path="/developers" element={<Developers />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/activity" element={<Activity />} />
      <Route path="/settings" element={<Settings />} />
    </Route>
  );

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={token ? <Navigate to="/" replace /> : <Register />} />

      {/* Protected shell */}
      <Route element={<RequireAuth />}>
        {shellRoutes}
      </Route>

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="p-8 max-w-sm text-center">
              <div className="text-4xl font-bold text-text-muted mb-2">404</div>
              <h2 className="text-xl font-bold text-text-primary mb-1">Page not found</h2>
              <p className="text-sm text-text-muted mb-4">This page doesn't exist or you don't have access.</p>
              <a href="/" className="text-sm text-primary hover:text-primary-hover font-medium">Go to dashboard →</a>
            </Card>
          </div>
        }
      />
    </Routes>
  );
}
