import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SOURCE_LANGUAGES, createClass, startClass } from '../api/classroom.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  CamIcon, CamOffIcon, CheckIcon, CopyIcon, GlobeIcon, MicIcon, MicOffIcon, ShieldIcon,
} from '../components/icons.jsx';

const EMPTY = { title: '', subject: '', topic: '', source_language: 'en' };

export default function HostSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState(EMPTY);
  const [classroom, setClassroom] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [permission, setPermission] = useState('idle');
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  const stopPreview = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };
  useEffect(() => () => stopPreview(), []);

  useEffect(() => {
    if (!classroom || permission !== 'idle') return;
    setPermission('asking');
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPermission('granted');
      })
      .catch(() => {
        /* A teacher with no devices can still open the class and type. */
        setPermission('denied');
        setMicOn(false);
        setCamOn(false);
      });
  }, [classroom, permission]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = micOn; });
  }, [micOn]);
  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = camOn; });
  }, [camOn]);

  const update = event => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      setClassroom(await createClass(form));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(classroom.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy automatically — select the code and copy it.');
    }
  }

  async function goLive() {
    setBusy(true);
    setError('');
    try {
      /* Students cannot join until the class is opened. */
      await startClass(classroom.id);
      stopPreview();
      navigate(`/call/${classroom.id}`, { state: { classroom, micOn, camOn, isHost: true } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!classroom) {
    return (
      <main className="host-setup">
        <a className="back" href="/">← Back to the homepage</a>
        <span className="eyebrow">Online mode • Teacher</span>
        <h1 className="display-lg">Set up your class</h1>
        <p className="lede">Students will hear you in their own language. Only a title and the language you teach in are required.</p>

        <form className="form host-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Class title</span>
            <input name="title" value={form.title} onChange={update} placeholder="Fractions — Class 5B" maxLength={200} required />
          </label>

          <div className="row">
            <label className="field">
              <span className="field-label">Subject</span>
              <input name="subject" value={form.subject} onChange={update} placeholder="Maths" maxLength={100} />
            </label>
            <label className="field">
              <span className="field-label">Topic</span>
              <input name="topic" value={form.topic} onChange={update} placeholder="Halves and quarters" maxLength={200} />
            </label>
          </div>

          <label className="field">
            <span className="field-label"><GlobeIcon width="15" height="15" /> You teach in</span>
            <div className="select-wrap">
              <select name="source_language" value={form.source_language} onChange={update}>
                {SOURCE_LANGUAGES.map(item => (
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
              </select>
            </div>
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary full" disabled={busy || !form.title.trim()}>
            {busy ? 'Creating class…' : 'Create class'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="host-setup">
      <a className="back" href="/">← Back to the homepage</a>
      <span className="eyebrow">Ready to go live</span>
      <h1 className="display-lg">{classroom.title}</h1>
      <p className="lede">Share this code with your students. They enter it to join and pick the language they want to hear.</p>

      <div className="code-share">
        <div>
          <span className="field-label">Join code</span>
          <p className="code-value">{classroom.join_code}</p>
        </div>
        <button className={`copy-btn ${copied ? 'is-copied' : ''}`} onClick={copyCode}>
          {copied ? <CheckIcon width="17" height="17" /> : <CopyIcon width="17" height="17" />}
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>

      <div className="host-grid">
        <div className="preview">
          <video ref={videoRef} autoPlay playsInline muted className={camOn && permission === 'granted' ? '' : 'is-hidden'} />
          {(!camOn || permission !== 'granted') && (
            <div className="preview-fallback">
              {permission === 'asking' ? 'Waiting for permission…' : camOn ? 'Camera unavailable' : 'Camera off'}
            </div>
          )}
        </div>

        <div className="host-side">
          {permission === 'denied' && (
            <p className="permission-note">
              <ShieldIcon width="15" height="15" />
              Mic and camera are blocked. Students won’t hear you until you allow the microphone.
            </p>
          )}

          <div className="device-row">
            <button className={`device-btn ${micOn ? 'is-on' : ''}`} onClick={() => setMicOn(v => !v)} disabled={permission !== 'granted'} aria-pressed={micOn}>
              {micOn ? <MicIcon /> : <MicOffIcon />}
              <span>{micOn ? 'Mic on' : 'Mic off'}</span>
            </button>
            <button className={`device-btn ${camOn ? 'is-on' : ''}`} onClick={() => setCamOn(v => !v)} disabled={permission !== 'granted'} aria-pressed={camOn}>
              {camOn ? <CamIcon /> : <CamOffIcon />}
              <span>{camOn ? 'Camera on' : 'Camera off'}</span>
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          <button className="btn-primary full" onClick={goLive} disabled={busy || permission === 'asking'}>
            {busy ? 'Opening the class…' : 'Start class'}
          </button>
          <p className="prompt-foot">Hosting as {user?.full_name || user?.username}</p>
        </div>
      </div>
    </main>
  );
}
