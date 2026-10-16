import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import JoinClassModal from '../components/JoinClassModal.jsx';
import HostPromptModal from '../components/HostPromptModal.jsx';

const HOME = '/';

/* Entry point the existing homepage links to when "Online Mode" is picked. */
export default function JoinEntry() {
  const { status, isAuthenticated, isTeacher, user } = useAuth();
  const navigate = useNavigate();

  if (status === 'loading') return <p className="page-note">Checking your session…</p>;

  if (!isAuthenticated) {
    return (
      <div className="gate">
        <span className="eyebrow">Online mode</span>
        <h1 className="display-lg">Sign in to join a class</h1>
        <p className="lede">Online sessions are only open to signed-in students and teachers.</p>
        <a className="btn-primary" href={HOME}>← Back to the homepage</a>
      </div>
    );
  }

  if (isTeacher) {
    return (
      <div className="gate gate-quiet">
        <p className="page-note">Signed in as {user.full_name || user.username}</p>
        <HostPromptModal
          open
          teacherName={user.full_name || user.username}
          onConfirm={() => navigate('/host')}
          onDismiss={() => { window.location.href = HOME; }}
        />
      </div>
    );
  }

  return (
    <div className="gate gate-quiet">
      <p className="page-note">Joining as {user.full_name || user.username}…</p>
      <JoinClassModal open onClose={() => { window.location.href = HOME; }} />
    </div>
  );
}
