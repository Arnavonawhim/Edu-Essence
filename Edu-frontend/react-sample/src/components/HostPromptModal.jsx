import { HostIcon } from './icons.jsx';

/* Asked the moment a teacher picks Online Mode. */
export default function HostPromptModal({ open, teacherName, onConfirm, onDismiss }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onDismiss()}>
      <div className="modal-card host-prompt" role="dialog" aria-modal="true" aria-label="Host a class">
        <button className="modal-close" onClick={onDismiss} aria-label="Close">×</button>

        <span className="prompt-mark"><HostIcon width="26" height="26" /></span>
        <h2 className="display-sm">Would you like to host a class?</h2>
        <p className="join-sub">
          You’ll get a join code to share with your students, and everything you say is
          translated live into the language each of them chose.
        </p>

        <div className="prompt-actions">
          <button className="btn-primary" onClick={onConfirm}>Yes, host a class</button>
          <button className="btn-ghost" onClick={onDismiss}>Not now</button>
        </div>
        <p className="prompt-foot">Signed in as {teacherName}</p>
      </div>
    </div>
  );
}
