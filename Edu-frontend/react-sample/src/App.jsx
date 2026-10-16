import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import RequireAuth from './routes/RequireAuth.jsx';
import JoinEntry from './pages/JoinEntry.jsx';
import HostSetup from './pages/HostSetup.jsx';
import CallRoom from './pages/CallRoom.jsx';

/* The homepage is the existing static site at /, so this app owns only the
   live-classroom screens under /app. */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/join" element={<JoinEntry />} />
        <Route
          path="/host"
          element={<RequireAuth role="teacher"><HostSetup /></RequireAuth>}
        />
        <Route
          path="/call/:classId"
          element={<RequireAuth><CallRoom /></RequireAuth>}
        />
        <Route path="*" element={<Navigate to="/join" replace />} />
      </Routes>
    </AuthProvider>
  );
}
