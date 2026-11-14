// @mentions : suggestions de pseudos pendant la frappe, partagées par la rédaction d'un bading et les commentaires.
// Taper « @ko » propose les Badeurs dont le pseudo commence par « ko » ; un clic insère « @Koffi225 ».
import { useEffect, useState } from 'react';
import * as badings from '../services/badings.js';
import { Avatar, Verified } from './icons.jsx';

export const MENTION_AT_CURSOR = /@([\w.]*)$/;
const MENTION_SEARCH_DELAY = 150; // on attend une courte pause dans la frappe avant d'interroger le serveur

/** Pseudos proposés pour le mot « @… » sous le curseur ; seule la réponse à la dernière frappe compte. */
export function useMentionSuggestions(query) {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (query === null) { setUsers([]); return undefined; }
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const found = await badings.searchPseudos(query);
        if (current) setUsers(found.filter(Boolean));
      } catch (error) {
        console.warn(error); // pas de suggestions, mais on peut toujours écrire
      }
    }, MENTION_SEARCH_DELAY);
    return () => { current = false; clearTimeout(timer); };
  }, [query]);
  return users;
}

/**
 * Mentions dans une zone de texte. `allow` : false pour ne plus rien proposer (ex. limite de mentions atteinte).
 * Renvoie les suggestions, `insert(pseudo)` et `trackCaret` à brancher sur onChange / onKeyUp / onClick.
 */
export function useMentions({ text, setText, textareaRef, allow = true }) {
  const [caret, setCaret] = useState(0);
  const match = text.slice(0, caret).match(MENTION_AT_CURSOR);
  const suggestions = useMentionSuggestions(allow && match ? match[1] : null);

  const insert = (pseudo) => {
    const before = text.slice(0, caret).replace(MENTION_AT_CURSOR, `@${pseudo} `);
    setText(before + text.slice(caret));
    setCaret(before.length);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(before.length, before.length);
    });
  };

  const trackCaret = (e) => setCaret(e.target.selectionEnd ?? 0);
  // Après insertion, la liste disparaît (plus de « @… » sous le curseur).
  const visible = match ? suggestions : [];
  return { suggestions: visible, insert, trackCaret };
}

/** Liste des pseudos proposés. */
export function MentionList({ users, onPick, compact = false }) {
  if (!users.length) return null;
  return (
    <div className={`mention-list ${compact ? 'compact' : ''}`} role="listbox" aria-label="Badeurs à mentionner" data-mentions="">
      {users.map((u) => (
        // onMouseDown : garde le focus dans la zone de texte (sinon le clavier se ferme sur téléphone)
        <button key={u.id} type="button" role="option" className="srow" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(u.pseudo)}>
          <Avatar user={u} size={compact ? 26 : 32} /><b>{u.pseudo}</b>{u.verified ? <Verified /> : null}
        </button>
      ))}
    </div>
  );
}
