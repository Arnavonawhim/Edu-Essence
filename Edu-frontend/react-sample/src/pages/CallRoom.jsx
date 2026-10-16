import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Room, RoomEvent, Track } from 'livekit-client';
import {
  LISTENING_LANGUAGES, endClass, getClass, getRoomToken, getStream,
  leaveClass, postUtterance, setListeningLanguage,
} from '../api/classroom.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  CamIcon, CamOffIcon, CaptionsIcon, CheckIcon, CopyIcon, EndCallIcon, GlobeIcon,
  LeaveIcon, LiveDot, MicIcon, MicOffIcon, PeopleIcon, SpeakerIcon,
} from '../components/icons.jsx';

const STREAM_INTERVAL_MS = 2000;
/* Long enough to hold a whole sentence, short enough to feel live. */
const UTTERANCE_CHUNK_MS = 5000;

export default function CallRoom() {
  const { classId } = useParams();
  const { state } = useLocation();
  const { user } = useAuth();

  const [classroom, setClassroom] = useState(state?.classroom ?? null);
  const [language, setLanguage] = useState(state?.targetLanguage ?? 'en');
  const [micOn, setMicOn] = useState(state?.micOn ?? true);
  const [camOn, setCamOn] = useState(state?.camOn ?? true);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const [captions, setCaptions] = useState([]);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [showCaptions, setShowCaptions] = useState(true);
  const [canPublish, setCanPublish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const isHost = (user?.role?.toLowerCase() === 'teacher');

  const roomRef = useRef(null);
  const stageRef = useRef(null);
  const selfRef = useRef(null);
  const cursorRef = useRef(0);
  const captionEndRef = useRef(null);
  const audioQueueRef = useRef([]);
  const playingRef = useRef(false);
  const recorderRef = useRef(null);
  const captureStreamRef = useRef(null);

  /* ---- media room ---- */
  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const attach = (track, participant) => {
      if (track.kind === Track.Kind.Video) {
        const element = track.attach();
        element.dataset.participant = participant.identity;
        stageRef.current?.appendChild(element);
      } else if (track.kind === Track.Kind.Audio) {
        document.body.appendChild(track.attach());
      }
    };

    room
      .on(RoomEvent.TrackSubscribed, attach)
      .on(RoomEvent.TrackUnsubscribed, track => track.detach().forEach(el => el.remove()))
      .on(RoomEvent.Disconnected, () => !cancelled && setConnection('disconnected'));

    (async () => {
      try {
        if (!classroom) {
          const detail = await getClass(classId);
          if (!cancelled) setClassroom(detail);
        }
        const credentials = await getRoomToken(classId);
        /* Set before connecting: a failed room must not strip the host's
           mute and camera controls. */
        if (!cancelled) setCanPublish(Boolean(credentials.can_publish));

        await room.connect(credentials.url, credentials.token);
        if (cancelled) return;

        if (credentials.can_publish) {
          await room.localParticipant.setMicrophoneEnabled(micOn);
          await room.localParticipant.setCameraEnabled(camOn);
          const camTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
          if (camTrack && selfRef.current) camTrack.attach(selfRef.current);
        }
        setConnection('live');
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not connect to the class.');
          setConnection('failed');
        }
      }
    })();

    return () => {
      cancelled = true;
      room.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  /* ---- translated caption + audio stream ---- */
  const playNext = useCallback(() => {
    if (playingRef.current || !audioQueueRef.current.length) return;
    const next = audioQueueRef.current.shift();
    playingRef.current = true;
    const audio = new Audio(`data:audio/${next.format || 'mpeg'};base64,${next.base64}`);
    audio.onended = audio.onerror = () => { playingRef.current = false; playNext(); };
    audio.play().catch(() => { playingRef.current = false; });
  }, []);

  useEffect(() => {
    let timer;
    let stopped = false;

    async function poll() {
      try {
        const data = await getStream(classId, cursorRef.current);
        if (stopped) return;
        if (data?.items?.length) {
          cursorRef.current = Math.max(cursorRef.current, data.cursor ?? 0);
          /* Overlapping polls can arrive out of order, so key by sequence. */
          setCaptions(prev => {
            const bySequence = new Map(prev.map(item => [item.sequence, item]));
            data.items.forEach(item => bySequence.set(item.sequence, item));
            return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence).slice(-60);
          });
          if (speakerOn) {
            data.items.filter(item => item.audio_base64)
              .forEach(item => audioQueueRef.current.push({ base64: item.audio_base64, format: item.audio_format }));
            playNext();
          }
        }
      } catch {
        /* A dropped poll is not worth interrupting the call for. */
      } finally {
        if (!stopped) timer = setTimeout(poll, STREAM_INTERVAL_MS);
      }
    }

    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [classId, language, speakerOn, playNext]);

  useEffect(() => {
    captionEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [captions]);

  /* ---- teacher: microphone capture feeding the translation pipeline ---- */
  const stopCapture = useCallback(() => {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    recorderRef.current = null;
    captureStreamRef.current?.getTracks().forEach(track => track.stop());
    captureStreamRef.current = null;
  }, []);

  useEffect(() => {
    /* Utterances upload over HTTP, so translation keeps working even if the
       video room is unreachable. */
    if (!isHost || !micOn) { stopCapture(); return; }
    if (typeof MediaRecorder === 'undefined') return;

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        captureStreamRef.current = stream;

        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = event => {
          if (event.data && event.data.size > 1000) {
            /* A failed chunk is dropped rather than stalling the lesson. */
            postUtterance(classId, event.data).catch(() => {});
          }
        };
        recorder.start(UTTERANCE_CHUNK_MS);
      } catch {
        /* No microphone: the class continues without live translation. */
      }
    })();

    return () => { cancelled = true; stopCapture(); };
  }, [isHost, micOn, classId, stopCapture]);

  /* ---- controls ---- */
  async function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    await roomRef.current?.localParticipant?.setMicrophoneEnabled(next).catch(() => {});
  }

  async function toggleCam() {
    const next = !camOn;
    setCamOn(next);
    await roomRef.current?.localParticipant?.setCameraEnabled(next).catch(() => {});
  }

  async function changeLanguage(code) {
    setLanguage(code);
    cursorRef.current = 0;
    setCaptions([]);
    audioQueueRef.current = [];
    try { await setListeningLanguage(classId, code); } catch { /* local switch still applies */ }
  }

  async function leave() {
    try { await leaveClass(classId); } catch { /* leaving locally regardless */ }
    stopCapture();
    roomRef.current?.disconnect();
    /* Full navigation, because the homepage is the existing static site. */
    window.location.href = '/';
  }

  /* Ends the class for everyone, so it asks first. */
  async function finishClass() {
    if (!window.confirm('End the class for everyone? Students will be disconnected.')) return;
    setEnding(true);
    try { await endClass(classId); } catch { /* still tearing down locally */ }
    stopCapture();
    roomRef.current?.disconnect();
    window.location.href = '/';
  }

  async function copyCode() {
    if (!classroom?.join_code) return;
    try {
      await navigator.clipboard.writeText(classroom.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the code stays visible to copy by hand */ }
  }

  const activeLanguage = useMemo(
    () => LISTENING_LANGUAGES.find(item => item.code === language) ?? LISTENING_LANGUAGES[0],
    [language]
  );

  return (
    <div className="call">
      <header className="call-bar">
        <div className="call-id">
          <LiveDot active={connection === 'live'} />
          <div>
            <p className="call-title">{classroom?.title ?? 'Live class'}</p>
            <p className="call-meta">
              {classroom?.teacher_name ? `${classroom.teacher_name} · ` : ''}
              {connection === 'live' ? 'Connected' : connection === 'connecting' ? 'Connecting…' : 'Not connected'}
            </p>
          </div>
        </div>

        {isHost ? (
          <div className="host-bar">
            {classroom?.participant_count !== undefined && (
              <span className="count-pill" title="Students in the class">
                <PeopleIcon width="15" height="15" />
                {classroom.participant_count}
              </span>
            )}
            <button className={`code-pill ${copied ? 'is-copied' : ''}`} onClick={copyCode}>
              <span className="code-pill-label">Join code</span>
              <strong>{classroom?.join_code ?? '······'}</strong>
              {copied ? <CheckIcon width="15" height="15" /> : <CopyIcon width="15" height="15" />}
            </button>
          </div>
        ) : (
          <label className="lang-pill">
            <GlobeIcon width="16" height="16" />
            <select value={language} onChange={e => changeLanguage(e.target.value)} aria-label="Listening language">
              {LISTENING_LANGUAGES.map(item => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </label>
        )}
      </header>

      <main className="call-body">
        <section className="stage-wrap">
          <div className="stage" ref={stageRef}>
            {connection !== 'live' && (
              <div className="stage-empty">
                {connection === 'failed' ? error : 'Waiting for your teacher’s video…'}
              </div>
            )}
          </div>
          <video ref={selfRef} className={`self-tile ${canPublish && camOn ? '' : 'is-off'}`} autoPlay playsInline muted />
        </section>

        {showCaptions && (
          <aside className="captions">
            <header className="captions-head">
              <CaptionsIcon width="16" height="16" />
              <span>{isHost ? 'What students are hearing' : 'Live translation'}</span>
              <em>{isHost ? classroom?.target_languages || '—' : activeLanguage.native}</em>
            </header>
            <div className="captions-body">
              {captions.length === 0 ? (
                <p className="captions-empty">
                  {isHost
                    ? 'Start speaking — each sentence is transcribed and translated for every student.'
                    : 'Translated speech will appear here as your teacher talks.'}
                </p>
              ) : (
                captions.map(item => (
                  <p key={item.sequence} className="caption">
                    <span className="caption-text">{item.translated_text}</span>
                    {item.original_text && item.translated_text !== item.original_text && (
                      <span className="caption-original">{item.original_text}</span>
                    )}
                  </p>
                ))
              )}
              <div ref={captionEndRef} />
            </div>
          </aside>
        )}
      </main>

      <footer className="call-controls">
        {/* A listen-only participant gets no publishing controls at all. */}
        {canPublish && (
          <>
            <button className={`ctrl ${micOn ? 'is-on' : 'is-off'}`} onClick={toggleMic} aria-pressed={micOn}>
              {micOn ? <MicIcon /> : <MicOffIcon />}
              <span className="ctrl-label">{micOn ? 'Mute' : 'Unmute'}</span>
            </button>
            <button className={`ctrl ${camOn ? 'is-on' : 'is-off'}`} onClick={toggleCam} aria-pressed={camOn}>
              {camOn ? <CamIcon /> : <CamOffIcon />}
              <span className="ctrl-label">{camOn ? 'Stop video' : 'Start video'}</span>
            </button>
          </>
        )}
        <button className={`ctrl ${speakerOn ? 'is-on' : 'is-off'}`} onClick={() => setSpeakerOn(v => !v)} aria-pressed={speakerOn}>
          <SpeakerIcon />
          <span className="ctrl-label">{speakerOn ? 'Translated audio' : 'Audio muted'}</span>
        </button>
        <button className={`ctrl ${showCaptions ? 'is-on' : 'is-off'}`} onClick={() => setShowCaptions(v => !v)} aria-pressed={showCaptions}>
          <CaptionsIcon />
          <span className="ctrl-label">Captions</span>
        </button>
        {isHost ? (
          <button className="ctrl ctrl-leave" onClick={finishClass} disabled={ending}>
            <EndCallIcon />
            <span className="ctrl-label">{ending ? 'Ending…' : 'End class'}</span>
          </button>
        ) : (
          <button className="ctrl ctrl-leave" onClick={leave}>
            <LeaveIcon />
            <span className="ctrl-label">Leave</span>
          </button>
        )}
      </footer>

      <p className="call-you">
        {isHost ? 'Hosting as ' : 'Joined as '}{user?.full_name || user?.username}
      </p>
    </div>
  );
}
