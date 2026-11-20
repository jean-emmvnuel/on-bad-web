// Hashtags dans le texte : liens vers #/tag/…, sans prendre une adresse web ou un e-mail pour un hashtag.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Rich, tagPath } from '../src/ui/icons.jsx';

const html = (text) => renderToStaticMarkup(<Rich text={text} />);

describe('hashtags', () => {
  it('un #mot devient un lien vers sa page (minuscules), accents compris', () => {
    expect(html('Le #Gbaka de ce matin')).toContain('<a class="hashtag" href="#/tag/gbaka">#Gbaka</a>');
    expect(html('#Ça_va')).toContain(`href="#${tagPath('ça_va')}"`);
  });

  it('pas un hashtag : ancre d’adresse, collé à un mot, un seul caractère, trop long', () => {
    expect(html('onbade.com/page#ancre')).not.toContain('class="hashtag"');
    expect(html('test@x.ci#pas')).not.toContain('class="hashtag"');
    expect(html('C#')).not.toContain('class="hashtag"');
    expect(html('#a')).not.toContain('class="hashtag"');
    expect(html(`#${'x'.repeat(31)}`)).not.toContain('class="hashtag"');
  });

  it('mentions et hashtags ensemble', () => {
    const out = html('Merci @inconnu pour le #maquis');
    expect(out).toContain('<span class="mention">@inconnu</span>');
    expect(out).toContain('href="#/tag/maquis"');
  });
});
