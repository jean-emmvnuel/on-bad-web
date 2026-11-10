import { describe, expect, it } from 'vitest';
import { MiniPdf, toWin } from '../src/lib/pdf.js';
import * as S from '../src/lib/store.js';
import { buildMyDataPdf } from '../src/lib/export.js';
import { loadFixtures } from './fixtures.js';

// jsdom n'a pas Blob.arrayBuffer : on passe par FileReader, comme un vieux navigateur.
const text = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(new TextDecoder('latin1').decode(r.result)); r.readAsArrayBuffer(blob); });

describe('Encodage du texte (WinAnsi)', () => {
  it('garde les accents et la ponctuation française', () => {
    const s = toWin('Éhhh ! « Ça va aller » — c’est l’été…');
    expect(s).toContain('Éhhh'); expect(s).toContain('«'); expect(s).toContain('é');
    expect([...s].some((c) => c.charCodeAt(0) === 0x97)).toBe(true);
    expect([...s].some((c) => c.charCodeAt(0) === 0x92)).toBe(true); // apostrophe typographique
  });
  it('retire les emojis et remplace les espaces fines par des espaces', () => {
    expect(toWin('Gbaka 😭 1 000')).toBe('Gbaka 1 000');
  });
  it('ne produit aucun caractère hors d’un octet', () => {
    expect([...toWin('→ ok 🎭 œuvre € ’')].every((c) => c.charCodeAt(0) < 256)).toBe(true);
  });
});

describe('Générateur PDF', () => {
  it('produit un PDF valide : en-tête, pages, polices, table xref', async () => {
    const pdf = new MiniPdf(); pdf.addPage(); pdf.text('Bonjour', 40, 40); pdf.addPage(); pdf.rect(10, 10, 100, 50, { fill: '#9810e6', r: 8 });
    const raw = await text(pdf.toBlob());
    expect(raw.startsWith('%PDF-1.4')).toBe(true);
    expect(raw.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(raw).toContain('/Count 2');
    expect(raw).toContain('/BaseFont /Helvetica-Bold');
    const xref = Number(/startxref\n(\d+)/.exec(raw)[1]);
    expect(raw.slice(xref, xref + 4)).toBe('xref');
  });
  it('échappe les parenthèses du texte', async () => {
    const pdf = new MiniPdf(); pdf.addPage(); pdf.text('(rires)', 0, 0);
    expect(await text(pdf.toBlob())).toContain('\\(rires\\)');
  });
  it('coupe un long texte en lignes qui tiennent dans la largeur', () => {
    const pdf = new MiniPdf();
    const lines = pdf.wrap('Le gbaka m’a déposé devant la maison, j’ai dit merci au chauffeur', 100, 10);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((l) => expect(l.length * 5).toBeLessThanOrEqual(100));
  });
});

describe('PDF « copie de mes données »', () => {
  it('contient le compte, les statistiques et les badings, sur plusieurs pages si besoin', async () => {
    loadFixtures(); S.finishOnboarding(); S.signIn('awa@test.ci', 'AwaLaGo225');
    for (let i = 0; i < 25; i++) S.get().postedToday = 0, S.publish(`Histoire numéro ${i} du quartier, encore une galère`, false);
    const blob = buildMyDataPdf();
    expect(blob.type).toBe('application/pdf');
    const raw = await text(blob);
    for (const t of ['Copie de mes donn', '@AwaLaGo225', 'Mes statistiques', 'Rires re', 'Rires donn', 'Vues re', 'Mes badings \\(27\\)', 'Histoire num']) expect(raw).toContain(t);
    expect(Number(/\/Count (\d+)/.exec(raw)[1])).toBeGreaterThan(2);
    expect(raw).toMatch(/Page 1 \/ \d+/);
  });
});
