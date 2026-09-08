import React, { useState, useEffect, useRef } from 'react';

const API_BASE_URL = 'https://edu-essence.onrender.com';

export default function App() {
  // 1. Immediately read and save token BEFORE hooks execute
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('access_token', tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
      return tokenFromUrl;
    }
    return localStorage.getItem('access_token') || '';
  });
  useEffect(() => {
  console.log('Current token:', token); 
}, [token]);

  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [sessionId, setSessionId] = useState(null);

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [teacherTranscript, setTeacherTranscript] = useState('');
  const [translatedTranscript, setTranslatedTranscript] = useState('');

  const recognitionRef = useRef(null);

  // Helper for authenticated headers
  const getAuthHeaders = () => {
    const activeToken = token || localStorage.getItem('access_token');
    const headers = {
      'Content-Type': 'application/json',
    };
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken.trim()}`;
    }
    return headers;
  };

  // 1. Fetch supported languages when token is ready
  useEffect(() => {
    async function fetchLanguages() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/translation/languages/`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setLanguages(data);
        if (data.length > 0) {
          setSelectedLanguage(data[0].code || data[0].name || data[0]);
        }
      } catch {
        setLanguages([
          { code: 'hi', name: 'Hindi (हिन्दी)' },
          { code: 'bn', name: 'Bengali (বাংলা)' },
          { code: 'te', name: 'Telugu (తెలుగు)' },
          { code: 'ta', name: 'Tamil (தமிழ்)' },
          { code: 'mr', name: 'Marathi (मराठी)' },
        ]);
        setSelectedLanguage('hi');
      }
    }
    fetchLanguages();
  }, [token]);

  // 2. Start a new teaching session matching schema
  useEffect(() => {
    if (!selectedLanguage || !token) return;

    let activeSessionId = null;

    async function startSession() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/translation/sessions/`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            source_language: 'en',
            target_language: selectedLanguage,
            title: 'Classroom Lecture',
            mode: 'in_person',
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          activeSessionId = data.id;
          setSessionId(data.id);
        } else {
          console.error('Session creation failed:', data);
        }
      } catch (err) {
        console.warn('Session started locally without backend sync.');
      }
    }

    startSession();

    return () => {
      if (activeSessionId) {
        fetch(`${API_BASE_URL}/api/translation/sessions/${activeSessionId}/end/`, {
          method: 'POST',
          headers: getAuthHeaders(),
        }).catch(() => {});
      }
    };
  }, [selectedLanguage, token]);

  // 3. API Translation Handler
  const handleTranslate = async (rawText) => {
    if (!rawText.trim()) return;
    setIsProcessing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/translation/translate/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text: rawText,
          source_language: 'en',
          target_language: selectedLanguage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const translated = data.translated_text;
        setTranslatedTranscript(translated);

        if (!isSpeakerMuted && translated) {
          playTranslatedAudio(translated);
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Synthesise Speech / Audio Output (Base64 audio response)
  const playTranslatedAudio = async (textToSpeak) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/translation/speech/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text: textToSpeak,
          language: selectedLanguage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audio_base64) {
          const format = data.audio_format || 'mp3';
          const audio = new Audio(`data:audio/${format};base64,${data.audio_base64}`);
          audio.play();
          return;
        }
      }
    } catch (err) {
      // Web Speech fallback
    }

    if ('speechSynthesis' in window && !isSpeakerMuted) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = selectedLanguage;
      window.speechSynthesis.speak(utterance);
    }
  };

  // 5. Browser Microphone Input (Web Speech Recognition)
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setTeacherTranscript('Voice recognition is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalSpeech = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalSpeech += event.results[i][0].transcript;
        }
      }

      if (finalSpeech) {
        setTeacherTranscript(finalSpeech);
        handleTranslate(finalSpeech);
      }
    };

    recognition.onerror = (err) => {
      if (err.error !== 'no-speech') {
        console.warn('Speech recognition error:', err.error);
      }
    };

    recognitionRef.current = recognition;

    if (!isMicMuted) {
      try {
        recognition.start();
      } catch (_) {}
    }

    return () => {
      try {
        recognition.stop();
      } catch (_) {}
    };
  }, [selectedLanguage, isSpeakerMuted]);

  // Handle Mute Button toggle
  const toggleMic = () => {
    if (isMicMuted) {
      setIsMicMuted(false);
      try {
        recognitionRef.current?.start();
      } catch (_) {}
    } else {
      setIsMicMuted(true);
      try {
        recognitionRef.current?.stop();
      } catch (_) {}
    }
  };

  // Handle Speaker Button toggle
  const toggleSpeaker = () => {
    if (!isSpeakerMuted) {
      window.speechSynthesis?.cancel();
    }
    setIsSpeakerMuted(!isSpeakerMuted);
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#EBE1C6] text-[#1F1B24] font-serif selection:bg-[#C7B4D8]">
      {/* Top Navbar */}
      <header className="px-6 md:px-12 py-4 border-b border-[#C7B4D8]/60 flex items-center justify-between bg-[#EBE1C6]">
        <div className="flex items-center gap-6">
          <a
            href="http://127.0.0.1:5500/Edu-frontend/index.html"
            className="text-sm italic text-[#1F1B24] hover:opacity-75 transition-opacity flex items-center gap-1.5"
          >
            <span>&larr;</span> Back to Home
          </a>
          <span className="font-display font-bold text-2xl tracking-tight">
            Edu-Essence
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Target Language Dropdown */}
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="targetLang" className="hidden sm:inline italic">
              Mother Tongue:
            </label>
            <select
              id="targetLang"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-white border border-[#C7B4D8] text-[#1F1B24] font-display text-xs md:text-sm rounded-full px-4 py-1.5 outline-none shadow-sm cursor-pointer"
            >
              {languages.map((lang, idx) => {
                const code = typeof lang === 'object' ? lang.code || lang.name : lang;
                const label = typeof lang === 'object' ? lang.name : lang;
                return (
                  <option key={idx} value={code}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Offline Mode Tag */}
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C7B4D8] font-display text-xs font-semibold text-[#1F1B24]">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            Offline Classroom
          </span>
        </div>
      </header>

      {/* Dual Classroom Boards */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Left Board: Spoken Teacher Speech */}
        <section className="bg-white border border-[#C7B4D8]/70 rounded-2xl shadow-xl flex flex-col overflow-hidden min-h-[380px]">
          <div className="px-6 py-4 border-b border-[#C7B4D8]/50 flex items-center justify-between bg-[#FAFAFA]">
            <span className="font-display font-bold text-sm tracking-wide text-[#1F1B24]">
              Teacher's Speech
            </span>
            <span className="text-xs italic text-[#5E5866]">
              {isMicMuted ? 'Microphone Muted' : 'Listening... (Speak now)'}
            </span>
          </div>
          <div className="flex-1 p-6 text-xl md:text-2xl leading-relaxed text-[#1F1B24] overflow-y-auto">
            {teacherTranscript || 'Speak into your microphone to transcribe classroom lecture in real time...'}
          </div>
        </section>

        {/* Right Board: Real-Time Vernacular Translation */}
        <section className="bg-white border border-[#C7B4D8]/70 rounded-2xl shadow-xl flex flex-col overflow-hidden min-h-[380px]">
          <div className="px-6 py-4 border-b border-[#C7B4D8]/50 flex items-center justify-between bg-[#FFF8D3]">
            <span className="font-display font-bold text-sm tracking-wide text-[#1F1B24]">
              Mother-Tongue Output
            </span>
            <span className="text-xs italic text-[#5E5866]">
              {isProcessing ? 'Translating...' : isSpeakerMuted ? 'Speaker Muted' : 'Live Translation'}
            </span>
          </div>
          <div className="flex-1 p-6 text-xl md:text-2xl leading-relaxed italic text-[#1F1B24] overflow-y-auto bg-[#FFF8D3]/30">
            {translatedTranscript || 'Translated vernacular speech will appear and be voiced here...'}
          </div>
        </section>
      </main>

      {/* Hardware Control Dock */}
      <footer className="p-6 border-t border-[#C7B4D8]/60 flex justify-center items-center gap-6 bg-[#EBE1C6]">
        {/* Input Toggle (Mic) */}
        <button
          type="button"
          onClick={toggleMic}
          className={`flex items-center gap-3 px-6 py-3 rounded-full font-display text-sm font-semibold shadow-md transition-all ${
            isMicMuted
              ? 'bg-[#FDF2F2] border border-[#B3261E] text-[#B3261E]'
              : 'bg-white border border-[#C7B4D8] hover:bg-[#FFF8D3] text-[#1F1B24]'
          }`}
        >
          <span className="relative flex items-center justify-center w-5 h-5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            {isMicMuted && (
              <svg className="absolute inset-0 w-5 h-5 text-[#B3261E]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="2" y1="2" x2="22" y2="22" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <span>{isMicMuted ? 'Input Muted' : 'Listening Active'}</span>
        </button>

        {/* Output Toggle (Speaker) */}
        <button
          type="button"
          onClick={toggleSpeaker}
          className={`flex items-center gap-3 px-6 py-3 rounded-full font-display text-sm font-semibold shadow-md transition-all ${
            isSpeakerMuted
              ? 'bg-[#FDF2F2] border border-[#B3261E] text-[#B3261E]'
              : 'bg-white border border-[#C7B4D8] hover:bg-[#FFF8D3] text-[#1F1B24]'
          }`}
        >
          <span className="relative flex items-center justify-center w-5 h-5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {!isSpeakerMuted && (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
              )}
            </svg>
            {isSpeakerMuted && (
              <svg className="absolute inset-0 w-5 h-5 text-[#B3261E]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="2" y1="2" x2="22" y2="22" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <span>{isSpeakerMuted ? 'Speaker Muted' : 'Speaker Active'}</span>
        </button>
      </footer>
    </div>
  );
}