// Icônes, logo, badge vérifié, avatar, texte avec @mentions : les briques d'affichage de toute l'app.
import { ICONS } from '../lib/icons-data.js';
import * as S from '../lib/store.js';

/** Icône Lucide (tracés statiques de icons-data.js). */
export function Icon({ name, className = '', style }) {
  return (
    <svg className={`i ${className}`} viewBox="0 0 24 24" aria-hidden="true" style={style}
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }} />
  );
}

const LOGO_STEM = 'M40 46a22 22 0 0 1 44 0V214a22 22 0 0 1-44 0Z';
const LOGO_BOWL = 'M68 158A78 78 0 1 0 224 158A78 78 0 1 0 68 158Z M104 146H188A42 42 0 0 1 104 146Z';

export function Logo({ size = 28, color = '#9810e6' }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill={color} role="img" aria-label="On Bade">
      <path d={LOGO_STEM} />
      <path fillRule="evenodd" d={LOGO_BOWL} />
    </svg>
  );
}

const TEETH = 'M110 146H127V155a4 4 0 0 1-4 4H114a4 4 0 0 1-4-4Z M129 146H146V155a4 4 0 0 1-4 4H133a4 4 0 0 1-4-4Z M148 146H165V155a4 4 0 0 1-4 4H152a4 4 0 0 1-4-4Z M167 146H184V155a4 4 0 0 1-4 4H171a4 4 0 0 1-4-4Z';

/** Le logo avec une bouche qui peut s'ouvrir (tirer pour rafraîchir). */
export function LaughingMark({ size = 44 }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden="true">
      <path d={LOGO_STEM} fill="#9810e6" />
      <path d="M68 158A78 78 0 1 0 224 158A78 78 0 1 0 68 158Z" fill="#9810e6" />
      <g className="mouth" style={{ transformOrigin: '57% 57%', transformBox: 'view-box' }}>
        <path d="M104 146H188A42 42 0 0 1 104 146Z" fill="#1a1919" />
        <path d="M124.4 182A21.6 14 0 0 1 167.6 182A42 42 0 0 1 124.4 182Z" fill="#FF6FA8" />
        <path d={TEETH} fill="#fff" />
      </g>
    </svg>
  );
}

export function Verified() {
  return (
    <svg className="verified" viewBox="0 0 24 24" aria-label="Compte vérifié">
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" fill="#9810e6" />
      <path d="m16 9-5.5 5.5L8 12" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Avatar : masque pour l'anonyme (`user` null), photo importée, sinon l'initiale sur une couleur. */
export function Avatar({ user, size = 44 }) {
  const box = { width: size, height: size };
  if (!user) {
    return (
      <span className="avatar anon" style={box} role="img" aria-label="Badeur anonyme">
        <Icon name="mask" style={{ width: size * 0.5, height: size * 0.5 }} />
      </span>
    );
  }
  if (user.photo) {
    return (
      <span className="avatar" style={box} role="img" aria-label={user.pseudo}>
        <img src={user.photo} alt="" draggable="false" />
      </span>
    );
  }
  return (
    <span className="avatar" role="img" aria-label={user.pseudo}
      style={{ ...box, background: `hsl(${user.hue},38%,30%)`, color: `hsl(${user.hue},80%,86%)`, fontSize: size * 0.42 }}>
      {user.pseudo?.[0]?.toUpperCase()}
    </span>
  );
}

const MENTION = /(@[\w.]+)/g;

/** Texte d'un utilisateur avec les @mentions colorées (React échappe tout le reste). */
export function Rich({ text = '' }) {
  return text.split(MENTION).map((part, i) => {
    if (!(i % 2)) return part;
    const u = S.userByPseudo(part.slice(1).replace(/\.+$/, ''));
    return u
      ? <a key={i} className="mention" href={`#${S.profilePath(u.id)}`}>{part}</a>
      : <span key={i} className="mention">{part}</span>;
  });
}
