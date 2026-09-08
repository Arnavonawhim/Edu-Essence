import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LISTENING_LANGUAGES, joinClass, resolveClassByCode } from '../api/classroom.js';
import { CamIcon, CamOffIcon, KeyIcon, MicIcon, MicOffIcon, ShieldIcon, GlobeIcon } from './icons.jsx';

export default function JoinClassModal({ open, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('details');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('en');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [classroom, setClassroom] = useState(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [permission, setPermission] = useState('idle');
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  const stopPreview = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open) {
      stopPreview();
      setStep('details');
      setError('');
      setClassroom(null);
      setPermission('idle');
    }
  }, [open]);

  useEffect(() => () => stopPreview(), []);

  async function requestDevices() {
    setPermission('asking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPermission('granted');
    } catch {
      /* Denied hardware is not fatal — audio-only listeners still get translations. */
      setPermission('denied');
      setMicOn(false);
      setCamOn(false);
    }
  }

  useEffect(() => {
    if (step === 'devices' && permission === 'idle') requestDevices();
  }, [step, permission]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = micOn; });
  }, [micOn]);

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach(track => { track.enabled = camOn; });
  }, [camOn]);

  if (!open) return null;

  async function submitCode(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await joinClass({ join_code: code, target_language: language });
      /* The join response identifies the participant, not the class, so the id
         has to come from the class list. That list may be teacher-only. */
      const found = await resolveClassByCode(code);
      if (!found) {
        throw new Error(
          'Joined the class, but the server did not return its id. ' +
          'The backend needs to include the class in /api/classroom/classes/ for students, ' +
          'or return class_id from /api/classroom/classes/join/.'
        );
      }
      setClassroom(found);
      setStep('devices');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function enterCall() {
    stopPreview();
    navigate(`/call/${classroom.id}`, {
      state: { targetLanguage: language, micOn, camOn, classroom },
    });
  }

  const selected = LISTENING_LANGUAGES.find(item => item.code === language);

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card join-card" role="dialog" aria-modal="true" aria-label="Join a class">
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        {step === 'details' ? (
          <>
            <span className="eyebrow">Online mode • Student</span>
            <h2 className="display-sm join-title">Join a live class</h2>
            <p className="join-sub">Enter the code your teacher shared, then pick the language you want to hear.</p>

            <form className="form" onSubmit={submitCode}>
              <label className="field">
                <span className="field-label"><KeyIcon width="15" height="15" /> Session code</span>
                <input
                  className="code-input"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  autoComplete="off"
                  spellCheck="false"
                  maxLength={12}
                  required
                />
              </label>

              <label className="field">
                <span className="field-label"><GlobeIcon width="15" height="15" /> Listen in</span>
                <div className="select-wrap">
                  <select value={language} onChange={e => setLanguage(e.target.value)}>
                    {LISTENING_LANGUAGES.map(item => (
                      <option key={item.code} value={item.code}>
                        {item.label} — {item.native}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              {error && <p className="error">{error}</p>}

              <button type="submit" className="btn-primary full" disabled={busy || !code.trim()}>
                {busy ? 'Checking code…' : 'Continue'}
              </button>
            </form>
          </>
        ) : (
          <>
            <span className="eyebrow">Ready to join</span>
            <h2 className="display-sm join-title">{classroom.title}</h2>
            <p className="join-sub">
              {classroom.teacher_name} · listening in <strong>{selected.label}</strong>
            </p>

            <div className="preview">
              <video ref={videoRef} autoPlay playsInline muted className={camOn && permission === 'granted' ? '' : 'is-hidden'} />
              {(!camOn || permission !== 'granted') && (
                <div className="preview-fallback">
                  {permission === 'asking' ? 'Waiting for permission…' : camOn ? 'Camera unavailable' : 'Camera off'}
                </div>
              )}
            </div>

            {permission === 'denied' && (
              <p className="permission-note">
                <ShieldIcon width="15" height="15" />
                Mic and camera are blocked. You can still join and listen to the translation.
              </p>
            )}

            <div className="device-row">
              <button
                type="button"
                className={`device-btn ${micOn ? 'is-on' : ''}`}
                onClick={() => setMicOn(v => !v)}
                disabled={permission !== 'granted'}
                aria-pressed={micOn}
              >
                {micOn ? <MicIcon /> : <MicOffIcon />}
                <span>{micOn ? 'Mic on' : 'Mic off'}</span>
              </button>
              <button
                type="button"
                className={`device-btn ${camOn ? 'is-on' : ''}`}
                onClick={() => setCamOn(v => !v)}
                disabled={permission !== 'granted'}
                aria-pressed={camOn}
              >
                {camOn ? <CamIcon /> : <CamOffIcon />}
                <span>{camOn ? 'Camera on' : 'Camera off'}</span>
              </button>
            </div>

            <button className="btn-primary full" onClick={enterCall} disabled={permission === 'asking'}>
              Join call
            </button>
            <button className="link-btn" onClick={() => setStep('details')}>← Use a different code</button>
          </>
        )}
      </div>
    </div>
  );
}
