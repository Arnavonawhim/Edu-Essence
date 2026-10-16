import { apiFetch } from './client.js';

/* "Neutral" means the original audio, untranslated. */
export const LISTENING_LANGUAGES = [
  { code: 'en', label: 'Neutral', native: 'Original audio' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

export const SOURCE_LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'hi', label: 'Hindi' },
  { code: 'mr', label: 'Marathi' }, { code: 'bn', label: 'Bengali' },
  { code: 'ta', label: 'Tamil' }, { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' }, { code: 'gu', label: 'Gujarati' },
];

export const listClasses = () => apiFetch('/api/classroom/classes/', { auth: true });

export const createClass = payload =>
  apiFetch('/api/classroom/classes/', { method: 'POST', body: payload, auth: true });

export const joinClass = ({ join_code, target_language }) =>
  apiFetch('/api/classroom/classes/join/', {
    method: 'POST',
    body: { join_code: join_code.trim().toUpperCase(), target_language },
    auth: true,
  });

export const getClass = classId => apiFetch(`/api/classroom/classes/${classId}/`, { auth: true });

export const startClass = classId =>
  apiFetch(`/api/classroom/classes/${classId}/start/`, { method: 'POST', auth: true });

export const endClass = classId =>
  apiFetch(`/api/classroom/classes/${classId}/end/`, { method: 'POST', auth: true });

export const leaveClass = classId =>
  apiFetch(`/api/classroom/classes/${classId}/leave/`, { method: 'POST', auth: true });

export const setListeningLanguage = (classId, target_language) =>
  apiFetch(`/api/classroom/classes/${classId}/language/`, {
    method: 'POST', body: { target_language }, auth: true,
  });

export const getRoomToken = classId =>
  apiFetch(`/api/classroom/classes/${classId}/token/`, { auth: true });

export const getTranscript = classId =>
  apiFetch(`/api/classroom/classes/${classId}/transcript/`, { auth: true });

/* `after` is the last sequence already received; the server answers in the
   caller's own language, set via setListeningLanguage. */
export const getStream = (classId, after = 0) =>
  apiFetch(`/api/classroom/classes/${classId}/stream/?after=${after}`, { auth: true });

/* Teacher side: one recorded chunk in, translations for every listener out. */
export function postUtterance(classId, audioBlob, { speak = true } = {}) {
  const form = new FormData();
  form.append('audio', audioBlob, 'utterance.webm');
  form.append('speak', String(speak));
  return apiFetch(`/api/classroom/classes/${classId}/utterances/`, {
    method: 'POST', body: form, auth: true,
  });
}

export const listLanguages = () => apiFetch('/api/translation/languages/', { auth: true });

/* The join response identifies the participant, not the class, so the class id
   is recovered from the roster by matching the code the student typed. */
export async function resolveClassByCode(joinCode) {
  const wanted = joinCode.trim().toUpperCase();
  const classes = await listClasses();
  return (Array.isArray(classes) ? classes : []).find(
    item => String(item.join_code).toUpperCase() === wanted
  ) ?? null;
}
