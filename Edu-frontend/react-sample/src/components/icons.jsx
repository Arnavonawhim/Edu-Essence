/* Hand-drawn to match the site: 1.6 stroke, round caps, currentColor. */
const base = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
};

export const MicIcon = props => (
  <svg {...base} {...props}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7" />
  </svg>
);

export const MicOffIcon = props => (
  <svg {...base} {...props}>
    <path d="M15 5.5A3 3 0 0 0 9 5.5v4M9 12.2a3 3 0 0 0 5 2.2" />
    <path d="M5 11a7 7 0 0 0 10.5 6M19 11a7 7 0 0 1-.6 2.8M12 18v3.5M8.5 21.5h7M3.5 3l17 18" />
  </svg>
);

export const CamIcon = props => (
  <svg {...base} {...props}>
    <rect x="2.5" y="6" width="13" height="12" rx="3" />
    <path d="M15.5 11l6-3.2v8.4l-6-3.2z" />
  </svg>
);

export const CamOffIcon = props => (
  <svg {...base} {...props}>
    <path d="M8 6h4.5a3 3 0 0 1 3 3v1.2M15.5 14.4V15a3 3 0 0 1-3 3H5.5a3 3 0 0 1-3-3V9a3 3 0 0 1 2-2.8" />
    <path d="M15.5 11l6-3.2v8.4l-3-1.6M3.5 3l17 18" />
  </svg>
);

export const LeaveIcon = props => (
  <svg {...base} {...props}>
    <path d="M15 4.5h2.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H15" />
    <path d="M10.5 8.5L14.5 12l-4 3.5M14 12H4.5" />
  </svg>
);

export const GlobeIcon = props => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
  </svg>
);

export const CaptionsIcon = props => (
  <svg {...base} {...props}>
    <rect x="2.5" y="5" width="19" height="14" rx="3" />
    <path d="M10 10.2a2.6 2.6 0 1 0 0 3.6M17.5 10.2a2.6 2.6 0 1 0 0 3.6" />
  </svg>
);

export const SpeakerIcon = props => (
  <svg {...base} {...props}>
    <path d="M11 5L6.5 9H3v6h3.5L11 19V5z" />
    <path d="M15 9.2a4 4 0 0 1 0 5.6M17.8 6.6a8 8 0 0 1 0 10.8" />
  </svg>
);

export const KeyIcon = props => (
  <svg {...base} {...props}>
    <circle cx="8" cy="12" r="3.5" />
    <path d="M11.5 12H21M18 12v3M15 12v2.2" />
  </svg>
);

export const ShieldIcon = props => (
  <svg {...base} {...props}>
    <path d="M12 3l8 3.5v5c0 5-3.4 8.6-8 9.5-4.6-.9-8-4.5-8-9.5v-5L12 3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const LiveDot = ({ active = true }) => (
  <span className={`live-dot ${active ? 'is-live' : ''}`} aria-hidden="true" />
);

export const HostIcon = props => (
  <svg {...base} {...props}>
    <path d="M3 20v-1.5c0-2.6 2.4-4 5-4s5 1.4 5 4V20" />
    <circle cx="8" cy="8" r="3.2" />
    <path d="M16 9.5h5M18.5 7v5M15.5 20v-1.2c0-1.3-.5-2.4-1.4-3.2" />
  </svg>
);

export const CopyIcon = props => (
  <svg {...base} {...props}>
    <rect x="9" y="9" width="11.5" height="11.5" rx="2.5" />
    <path d="M15 6.5V6a2.5 2.5 0 0 0-2.5-2.5h-6A2.5 2.5 0 0 0 4 6v6a2.5 2.5 0 0 0 2.5 2.5H7" />
  </svg>
);

export const CheckIcon = props => (
  <svg {...base} {...props}><path d="M4.5 12.5l5 5 10-11" /></svg>
);

export const PeopleIcon = props => (
  <svg {...base} {...props}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19.5v-1c0-2.6 2.7-4 6-4s6 1.4 6 4v1M16 5.4a3.2 3.2 0 0 1 0 5.2M18 14.8c2 .6 3.5 1.8 3.5 3.7v1" />
  </svg>
);

export const EndCallIcon = props => (
  <svg {...base} {...props}>
    <path d="M2.6 14.2c5.2-4.3 13.6-4.3 18.8 0 .9.7 1 1.4.3 2.2l-1.5 1.6c-.6.7-1.3.8-2.1.3l-2.3-1.4c-.6-.4-.9-.9-.9-1.6v-1.4a12.6 12.6 0 0 0-5.8 0v1.4c0 .7-.3 1.2-.9 1.6l-2.3 1.4c-.8.5-1.5.4-2.1-.3l-1.5-1.6c-.7-.8-.6-1.5.3-2.2z" />
  </svg>
);
