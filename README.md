<div align="center">

<img src=".github/assets/banner.svg" alt="On Bade — raconte ce qui t'est arrivé, fais rire tout le monde" width="100%"/>

<br/>

<img src="https://img.shields.io/badge/HTML-CSS-1a1919?style=for-the-badge&logo=html5&logoColor=B76BFF" alt="HTML CSS"/>
<img src="https://img.shields.io/badge/JavaScript-ES%20modules-1a1919?style=for-the-badge&logo=javascript&logoColor=B76BFF" alt="JavaScript"/>
<img src="https://img.shields.io/badge/GSAP-3.13-1a1919?style=for-the-badge&logo=greensock&logoColor=B76BFF" alt="GSAP"/>
<img src="https://img.shields.io/badge/Sans%20build-0%20d%C3%A9pendance-9810e6?style=for-the-badge" alt="Sans build"/>

</div>

---

## 😂 On Bade, version web

**On Bade** est le réseau social où l'on raconte ce qui nous est arrivé… pour faire rire tout le monde. En nouchi, **« bader »** veut dire faire des blagues, amuser la galerie : un **bading** est une histoire drôle vécue, publiée **signée ou en « Badeur anonyme »**.

> **Ici, la seule règle, c'est qu'il n'y a pas de règle.** Enfin… presque : on rit des situations, jamais des personnes.

Ce dépôt est la **version web** de l'app mobile ([jean-emmvnuel/jebade](https://github.com/jean-emmvnuel/jebade)), écrite en **HTML, CSS et JavaScript natif**, animée avec **GSAP**. Même identité, mêmes règles, mêmes écrans, pensée pour le téléphone *et* l'ordinateur.

<div align="center"><img src=".github/assets/feed-card.svg" alt="Un bading, les rires montent en direct" width="460"/></div>

## ✨ Ce que fait le site

| | |
|---|---|
| 🎬 | **Splash GSAP** : le b du logo rit (avec ses dents) puis zoome vers l'app |
| 🎨 | **Onboarding** à glisser (doigt ou souris) : la couleur de fond se transforme, cartes en parallaxe |
| 🔐 | **Inscription** e-mail + mot de passe (afficher/masquer, confirmation), pseudo + charte du Badeur ; **connexion** et mot de passe oublié |
| 📰 | **Fil** façon X : en-tête qui se replie, entrée des cartes en cascade, **pull-to-refresh** où le b rit pendant le chargement |
| 😂 | **Rire** avec explosion de **confettis** (physique GSAP) |
| 🖼️ | **Bading en image** : texte, image ou les deux ; **recadrage avant publication** en portrait 4:5 ou carré 1:1 (fil uniforme), zoom, rotation, déplacement ; légende de 280 caractères max ; JPEG 1 080 px max, métadonnées supprimées |
| 💬 | **Commentaires et réponses** en texte ou en **sticker** : 16 stickers On Bade (réactions, nouchi) + **stickers personnels** comme sur TikTok (créés depuis une photo, ou enregistrés en touchant le sticker d'un Badeur ; collection de 50), traits de fil, repli des réponses, suppression avec confirmation |
| 🔁 | **Rebade** direct ou avec avis · 📤 **Partage** WhatsApp, Facebook, lien dynamique, **image PNG générée** (canvas) |
| 🔖 | **Favoris**, 🎭 **mode anonyme**, @mentions avec suggestions, brouillon gardé |
| 👤 | **Profil** : statistiques qui défilent, onglets Badings / Favoris / Anonymes, **photo de profil** importée et recadrée en rond |
| 🔔 | **Notifications du navigateur** (rires, réponses) |
| ⚙️ | Paramètres : pseudo, mentions, blocages, badge vérifié, **demande de suppression du compte**, copie des données, confidentialité |
| 💻 | **Vrai rendu web** sur ordinateur : barre de navigation en haut, 3 colonnes (mon compte · fil en cartes · badings du moment), inscription en écran partagé ; barre d'onglets sur mobile |
| 📲 | **PWA installable** (Android, iPhone, ordinateur) : hors ligne, raccourcis « Bader » et « Notifications », partage de texte vers On Bade |
| 🔗 | **Liens dynamiques** `…/?b=<id>` : ils s'ouvrent dans l'app installée, sinon sur le site, directement sur le bading |
| ♿ | Clavier, focus visibles, libellés ARIA, `prefers-reduced-motion` respecté |

## 🚀 Lancer

Aucun build, aucune installation : un simple serveur statique suffit (les modules ES ne marchent pas en `file://`).

```bash
python3 -m http.server 5173
```

Puis ouvre <http://localhost:5173>. Crée un compte avec n'importe quel e-mail : les comptes de démo sont gardés dans le navigateur (mot de passe haché).

Avec `USE_BACKEND = true` (`js/api.js`), les données viennent du backend décrit dans [`API.md`](API.md). Avec `false`, elles sont simulées et gardées dans le navigateur (`localStorage`), comme avant. Pour repartir de zéro : `localStorage.removeItem('jebade-web-v1')` dans la console.

## 🗂️ Structure

```
index.html            ← coquille, splash, chargement de GSAP
css/style.css         ← tokens (identiques au mobile), mise en page, composants
js/app.js             ← routeur (hash), coquille web responsive, splash GSAP
js/cropper.js         ← écran de recadrage d'image (F1)
js/stickers.js        ← bibliothèque de stickers (F8)
js/pwa.js             ← service worker, installation, liens dynamiques, partage vers l'app
sw.js                 ← service worker (cache hors ligne, notifications)
manifest.webmanifest  ← manifeste de la PWA
js/api.js             ← client HTTP du backend (URL, jeton, erreurs) — USE_BACKEND = mode backend ou démo
js/services/*.js      ← lien API ↔ store : appelle le backend et range les réponses dans le cache
js/store.js           ← état local (cache des données du serveur) + règles métier + données de démo
js/components.js      ← carte de bading, actions, rebade, partage (image canvas), menus
js/ui.js              ← icônes, avatars, feuilles, toasts, confettis GSAP
js/notify.js          ← notifications du navigateur + activité simulée
js/views/             ← écrans (un dossier par écran complexe) ; views/shared/remote.js = chargement, erreurs, boutons en attente
data/privacy.json     ← politique de confidentialité (même source que l'app)
```

Les liens partagés ont la forme `…/?b=<id>` (l'ancienne forme `…/#/b/<id>` marche toujours) : sans compte, le visiteur passe par l'inscription puis arrive directement sur le bading.

## 📲 PWA

- `manifest.webmanifest` : nom, icônes, raccourcis, `share_target` (partager un texte depuis une autre app ouvre « Nouveau bading »), `launch_handler` + `handle_links` (un lien On Bade ouvre l'app déjà installée).
- `sw.js` : coquille en cache (hors ligne, ouverture instantanée), polices et GSAP en cache, clic sur les notifications. **Change `VERSION` dans `sw.js` à chaque mise en ligne.**
- `js/pwa.js` : enregistrement du service worker, bouton « Installer l'app » (invite native sur Chrome/Edge/Android, mode d'emploi sur iPhone), lecture des liens `?b=` et des partages.
- L'installation demande **HTTPS** (ou `localhost`).

---

<div align="center">

**On Bade** · une app **ORIVERSE** · Créée par **Jean Emmanuel Ahossi** — [portfolio](https://jeanemmanuel-portfolio-gamma.vercel.app/)

</div>

## Tests

Tests unitaires avec [Vitest](https://vitest.dev) (navigateur simulé par jsdom). Le site n’a toujours pas de build : `package.json` ne sert qu’aux tests.

```bash
npm install
npm test            # une fois
npm run test:watch  # en continu
```

| Fichier | Ce qui est vérifié |
| --- | --- |
| `tests/store.test.js` | Règles de publication (10–1 000 caractères, légende 280, mots interdits, 5 mentions, 20 par jour), anonymat, rires, vues, partages, favoris, rebades, commentaires et stickers (collection de 50), compte (mot de passe haché, photo, pseudo, blocage, suppression), conditions du badge, copie des données, formats |
| `tests/migrations.test.js` | Les données gardées dans le navigateur survivent à un rechargement et aux changements de version |
| `tests/pdf.test.js` | Générateur PDF (encodage des accents, structure du fichier, coupure des lignes) et PDF « copie de mes données » |
| `tests/helpers.test.js` | Choix d’image (formats, 10 Mo), stickers, échappement du HTML, avatars |
