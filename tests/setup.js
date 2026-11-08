// Ce que le navigateur fournit et que jsdom n'a pas : canvas (mesure du texte), crypto.subtle, matchMedia, GSAP.
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

// Mesure de texte déterministe : 0,5 × taille de police par caractère (gras : 0,55).
HTMLCanvasElement.prototype.getContext = function () {
  return {
    font: '10px Arial',
    measureText(s) { const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10); return { width: s.length * size * (this.font.startsWith('bold') ? 0.55 : 0.5) }; },
  };
};
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.gsap ??= { to() {}, from() {}, fromTo() {}, set() {}, killTweensOf() {}, timeline: () => ({ to() { return this; } }) };
