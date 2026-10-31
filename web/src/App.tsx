import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider } from './components/ui';
import { BrandMark } from './components/Icon';

import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import Quizzes from './pages/Quizzes';
import QuizEditor from './pages/QuizEditor';
import Host from './pages/Host';
import Projector from './pages/Projector';
import Verify from './pages/Verify';
import LiveConsole from './pages/LiveConsole';
import Participants from './pages/Participants';
import Results from './pages/Results';
import Certificates from './pages/Certificates';
import Fields from './pages/Fields';
import Sheets from './pages/Sheets';
import Emails from './pages/Emails';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Audit from './pages/Audit';
import NotFound from './pages/NotFound';
import Landing from './pages/student/Landing';
import Join from './pages/student/Join';
import Attempt from './pages/student/Attempt';
import Result from './pages/student/Result';


const ADMIN_ROUTES = [
  { path: '/admin', element: <Dashboard /> },
  { path: '/admin/quizzes', element: <Quizzes /> },
  { path: '/admin/quizzes/:quizId', element: <QuizEditor /> },
  { path: '/admin/quizzes/:quizId/host', element: <Host /> },
  { path: '/admin/live', element: <LiveConsole /> },
  { path: '/admin/participants', element: <Participants /> },
  { path: '/admin/results', element: <Results /> },
  { path: '/admin/certificates', element: <Certificates /> },
  { path: '/admin/fields', element: <Fields /> },
  { path: '/admin/sheets', element: <Sheets /> },
  { path: '/admin/emails', element: <Emails /> },
  { path: '/admin/settings', element: <Settings /> },
  { path: '/admin/users', element: <Users /> },
  { path: '/admin/audit', element: <Audit /> },
];

function BootSplash() {
  return (
    <div className="auth-shell center">
      <div className="stack center" style={{ gap: 14 }}>
        <BrandMark />
        <span className="spinner" />
        <span className="tiny" style={{ color: 'rgba(255,255,255,.55)' }}>
          Checking your session…
        </span>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const location = useLocation();
  if (loading) return <BootSplash />;
  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useSession();

  return (
    <Routes>
      {/* public */}
      <Route path="/" element={<Landing />} />
      <Route path="/j/:joinCode" element={<Join />} />
      <Route path="/j/:joinCode/attempt" element={<Attempt />} />
      <Route path="/j/:joinCode/result" element={<Result />} />
      <Route path="/present/:joinCode" element={<Projector />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/verify/:certificateId" element={<Verify />} />

      {/* admin */}
      <Route
        path="/admin/login"
        element={loading ? <BootSplash /> : user ? <Navigate to="/admin" replace /> : <LoginPage />}
      />

      {ADMIN_ROUTES.map(({ path, element }) => (
        <Route key={path} path={path} element={<RequireAuth>{element}</RequireAuth>} />
      ))}

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </SessionProvider>
  );
}
