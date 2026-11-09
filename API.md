# API On Bade — contrat attendu par le site web

Ce document décrit ce que le site web envoie au backend et ce qu'il attend en retour.
Les appels sont faits par `src/lib/api.js` ; les réponses sont rangées dans le store par `src/services/`.

> **Ce qui existe aujourd'hui** dans `onbad-backend` : `POST /api/login` et `POST /api/register` (voir ci-dessous).
> Tout le reste de ce document est **proposé** à partir des besoins des écrans. Tant que ces routes n'existent pas,
> le contenu reste simulé dans le navigateur (`VITE_BACKEND_CONTENT=false`).

### Ce que le site attend de /login et /register (format actuel du backend)

Réponses enveloppées, que le site déballe (`src/lib/api.js`) :

```json
{ "success": true, "message": "…", "data": { "user": { "id", "username", "firstName", "lastName", "email" }, "token": "<JWT>" } }
```

| Route | Corps envoyé | Erreurs comprises |
|---|---|---|
| `POST /register` | `{ firstname, lastname, username, email, password }` | 400 données invalides, 409 e-mail ou pseudo déjà pris |
| `POST /login` | `{ email, password }` | 400 données invalides, 404 e-mail inconnu, 401 mauvais mot de passe |

Le site traduit `username` → pseudo, `avatarUrl` → photo, `createdAt` → date d'inscription, et ne garde aucun autre champ.

## Conventions

| Sujet | Règle |
|---|---|
| Adresse | `VITE_API_URL` dans `.env` (par défaut `http://localhost:3000/api`) |
| Format | JSON en entrée et en sortie (sauf `POST /me/badge-request` : `multipart/form-data`) |
| Session | `/login` et `/register` renvoient un `token`, renvoyé ensuite dans `Authorization: Bearer <token>` |
| Session expirée | Répondre **401** : le site efface le jeton et renvoie vers la connexion |
| Dates | Nombres en millisecondes depuis 1970 (`Date.now()`) |
| Réponse vide | **204** sans corps |
| CORS | Le site est servi sur une autre origine : autoriser son origine et l'en-tête `Authorization` |

### Erreurs

Toute réponse en erreur (4xx, 5xx) renvoie :

```json
{ "code": "taken", "message": "Texte facultatif, affiché si le site ne connaît pas le code" }
```

Codes métier reconnus par les écrans :

| Code | Statut conseillé | Où |
|---|---|---|
| `unknown` | 404 | Connexion : aucun compte pour cet e-mail |
| `wrong_password` | 401 | Connexion |
| `taken` | 409 | Inscription (e-mail ou pseudo), changement de pseudo |
| `too_short`, `too_long`, `caption_too_long`, `too_many_mentions`, `blocked_word`, `daily_limit` | 422 | Publication d'un bading |
| `blocked_word` | 422 | Commentaire |
| `full` | 422 | Stickers : collection pleine |

## Objets

Les objets ont **la même forme que dans `src/lib/store.js`**, pour que les écrans les affichent sans conversion.

```js
User         { id, pseudo, verified, hue, photo?, joinedAt? }
Bading       { id, authorId, anonymous, text, image?: { src, ratio }, rebadeOf?, createdAt,
               likes, likedByMe, rebades, shares, views, deleted? }
Comment      { id, badingId, authorId, text, sticker?, parentId, replyTo?, createdAt, likes, likedByMe }
Notification { id, kind: 'like'|'rebade'|'mention'|'comment'|'reply'|'badge', actorId?, others?,
               badingId?, badgeStatus?, createdAt, read }
Sticker      { id, ownerId, src, createdAt }
Badge        { status: 'none'|'pending'|'accepted'|'refused', reason?, decidedAt? }
Deletion     { status: 'none'|'pending', requestedAt?, reason? }
```

- Un bading **anonyme** ne doit jamais exposer son vrai auteur aux autres (le serveur peut renvoyer `authorId: null`).
  Seul son auteur le voit avec son propre `authorId`.
- `authorId` de l'utilisateur connecté : le site le reconnaît en le comparant à l'`id` reçu à la connexion.

## Routes

### Authentification

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `POST /register` | `{ firstname, lastname, username, email, password }` | `{ token, user }` |
| `POST /login` | `{ email, password }` | `{ token, user }` |
| `POST /logout` | — | 204 |
| `GET /email-available?email=` | — | `{ available }` |
| `GET /pseudo-available?pseudo=` | — | `{ available }` |
| `POST /password-reset` | `{ email }` | 204 (même si l'e-mail est inconnu) |

### Badings

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `GET /feed` | — | `{ badings, users }` |
| `GET /feed?since=<ms>` | — | `{ badings, users }` : seulement ceux publiés après `since` |
| `GET /badings/:id` | — | `{ bading, users, comments, rebades }` ou **404** |
| `POST /badings` | `{ text, anonymous, image: { dataUrl, ratio } \| null }` | `{ bading }` |
| `POST /badings/:id/views` | — | 204 |
| `POST /badings/:id/like` | — | `{ likes, likedByMe }` (bascule) |
| `POST /badings/:id/rebades` | `{ text, anonymous }` (`text` vide = rebade directe) | `{ bading, rebades }` (`rebades` = nouveau compteur de l'original) |
| `POST /badings/:id/shares` | — | 204 |
| `POST /badings/:id/report` | `{ reason }` | 204 |
| `DELETE /badings/:id` | — | 204 (seulement mes badings) |

`users` contient les auteurs cités par les badings et commentaires renvoyés.
`rebades` = les rebades **avec avis** de ce bading.

### Commentaires

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `POST /badings/:id/comments` | `{ text, stickerId \| null, parentId \| null }` | `{ comment }` |
| `DELETE /comments/:id` | — | 204 (supprime aussi les réponses) |
| `POST /comments/:id/like` | — | `{ likes, likedByMe }` (bascule) |
| `POST /comments/:id/report` | `{ reason }` | 204 |

### Utilisateurs et stickers

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `GET /users/search?q=` | — | `{ users }` (pseudos qui commencent par `q`, sans les comptes bloqués) |
| `POST /stickers` | `{ image: <data URL> }` | `{ sticker }` |
| `PUT /me/stickers/:id` | — | 204 |
| `DELETE /me/stickers/:id` | — | 204 |

### Mon compte

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `GET /me/profile` | — | `{ user, badings, favorites, users }` (`badings` = les miens, anonymes compris) |
| `PATCH /me` | `{ pseudo }` | `{ user }` (le badge vérifié est retiré) |
| `PUT /me/photo` | `{ image: <data URL> \| null }` | `{ user }` |
| `GET /me/settings` | — | `{ mentionPolicy, blocked: User[], badge, deletion }` |
| `PATCH /me/settings` | `{ mentionPolicy: 'everyone' \| 'nobody' }` | 204 |
| `PUT /me/blocked/:userId` | — | 204 (bloquer) |
| `DELETE /me/blocked/:userId` | — | 204 (débloquer) |
| `PUT /me/favorites/:badingId` | — | 204 |
| `DELETE /me/favorites/:badingId` | — | 204 |
| `POST /me/badge-request` | form-data : `links` (répété), `document` (fichier) | `{ badge }` |
| `POST /me/deletion` | `{ reason \| null }` | `{ deletion }` |
| `DELETE /me/deletion` | — | 204 |

### Notifications

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `GET /notifications` | — | `{ notifications, users, badings }` |
| `POST /notifications/read` | — | 204 |

## Reste dans le navigateur

- **Copie de mes données (PDF)** (`src/lib/export.js`) : construite à partir du cache local, donc incomplète
  avec le backend. Prévoir une route `GET /me/export`.
- **Brouillon** et **fin de l'onboarding** : restent volontairement dans le navigateur.

Les actions des cartes (rire, rebade, partage, favori, signalement, blocage, suppression) passent par le backend
depuis la version React : l'écran change tout de suite, puis revient en arrière si le serveur refuse.
