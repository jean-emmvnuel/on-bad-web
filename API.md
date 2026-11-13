# API On Bade — contrat attendu par le site web

Ce document décrit ce que le site web envoie au backend et ce qu'il attend en retour.
Les appels sont faits par `src/lib/api.js` ; les réponses sont rangées dans le store par `src/services/`.

> **Toutes les routes de ce document existent** dans `onbad-backend` (voir son README pour les routes d'administration).
> Le contenu vient du backend par défaut ; `VITE_BACKEND_CONTENT=false` le garde simulé dans le navigateur.

Réponses enveloppées, que le site déballe (`src/lib/api.js`) :

```json
{ "success": true, "message": "…", "data": { … } }
{ "success": false, "code": "taken", "message": "Ce pseudo est déjà pris" }
```

`/login` et `/register` renvoient `{ user, token }` ; `user` est mon profil complet
(`id, username, pseudo, verified, photo, joinedAt, email, firstName, lastName, bio, points, mentionPolicy, badges`).

## Conventions

| Sujet | Règle |
|---|---|
| Adresse | `VITE_API_URL` dans `.env` (par défaut `http://localhost:3000/api`) — seules les variables `VITE_*` sont lues |
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
| `account_blocked` | 403 | Connexion et toute route : compte suspendu par l'équipe (motif dans `message`) |
| `email_taken`, `pseudo_taken` | 409 | Inscription (le site les traduit en `account_exists` / `taken`) |
| `taken` | 409 | Changement de pseudo |
| `invalid_pseudo`, `invalid_email`, `weak_password`, `invalid_name` | 400 | Inscription |
| `session_expired`, `invalid_token`, `unauthorized` | 401 | Toute route connectée |
| `too_short`, `too_long`, `caption_too_long`, `too_many_mentions`, `blocked_word`, `daily_limit` | 422 | Publication d'un bading |
| `blocked_word` | 422 | Commentaire |
| `full` | 422 | Stickers : collection pleine |
| `not_eligible`, `too_soon`, `invalid_links`, `missing_document` | 422 | Demande de badge vérifié |
| `already_pending`, `already_verified` | 409 | Demande de badge vérifié |
| `not_found` | 404 | Bading, commentaire ou sticker introuvable (ou bloqué) |

## Objets

Les objets ont **la même forme que dans `src/lib/store.js`**, pour que les écrans les affichent sans conversion.

```js
User         { id, pseudo, verified, hue, photo?, joinedAt? }
Bading       { id, authorId, anonymous, text, image?: { src, ratio }, rebadeOf?, createdAt,
               likes, likedByMe, rebades, shares, views, commentCount, deleted? }
Comment      { id, badingId, authorId, text, sticker?, parentId, replyTo?, createdAt, likes, likedByMe }
Notification { id, kind: 'like'|'rebade'|'mention'|'comment'|'reply'|'badge', actorId?, others?,
               badingId?, badgeStatus?, createdAt, read }
Sticker      { id, ownerId, src, createdAt }
Badge        { status: 'none'|'pending'|'accepted'|'refused', reason?, decidedAt? }
Deletion     { status: 'none'|'pending', requestedAt?, reason? }
```

- Un bading **anonyme** ne doit jamais exposer son vrai auteur aux autres (le serveur peut renvoyer `authorId: null`).
  Seul son auteur le voit avec son propre `authorId`.
- `origins` (renvoyé avec `badings`) : badings d'origine des rebades qui ne sont pas dans la liste, à ranger aussi.
- Les URL d'images (`image.src`, `photo`, `Sticker.src`) sont absolues : `…/api/uploads/<id>`.
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
| `POST /password-reset` | `{ email }` | 204 (même si l'e-mail est inconnu) ; le lien ouvre `/#/reset-password?token=…` |
| `POST /password-reset/confirm` | `{ token, password }` | 204 ; 400 `invalid_token` ou `weak_password` |

Le jeton de réinitialisation expire après une heure et ne peut être utilisé qu'une fois.
Le backend actuel journalise le lien côté serveur ; l'envoi d'e-mail doit être configuré côté backend.

### Badings

`GET /feed` et `GET /badings/:id` sont publics. Les publications, vues et autres interactions restent réservées aux utilisateurs connectés.

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `GET /feed` | — | `{ badings, origins, users }` (50 plus récents) |
| `GET /feed?since=<ms>` | — | `{ badings, origins, users }` : seulement ceux publiés après `since` (`before=<ms>` : page suivante) |
| `GET /badings/:id` | — | `{ bading, origins, users, comments, rebades, stickers }` ou **404** |
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
| `POST /badings/:id/comments` | `{ text, stickerId \| null, parentId \| null, replyToId? }` | `{ comment }` (`replyToId` : commentaire auquel on répond) |
| `DELETE /comments/:id` | — | 204 (supprime aussi les réponses) |
| `POST /comments/:id/like` | — | `{ likes, likedByMe }` (bascule) |
| `POST /comments/:id/report` | `{ reason }` | 204 |

### Utilisateurs et stickers

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `GET /users/search?q=` | — | `{ users }` (pseudos qui commencent par `q`, sans les comptes bloqués) |
| `GET /users/:id` | — | `{ user, badings, origins, users }` : profil public d'un Badeur ou **404** `not_found` |
| `POST /stickers` | `{ image: <data URL> }` | `{ sticker }` |
| `GET /me/stickers` | — | `{ stickers }` (ma collection) |
| `PUT /me/stickers/:id` | — | 204 |
| `DELETE /me/stickers/:id` | — | 204 |

`GET /users/:id` est **public** (lisible sans être connecté), comme `GET /feed`. Il alimente la page `#/u/<id>` :
- `user` : `{ id, pseudo, verified, photo?, joinedAt? }` — jamais l'e-mail, le nom ni les réglages ;
- `badings` : ses badings **signés** seulement (rebades comprises), du plus récent au plus ancien.
  Ses badings anonymes ne doivent **jamais** y figurer, même s'ils sont à lui.

### Mon compte

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `GET /me` | — | `{ user }` |
| `GET /me/profile` | — | `{ user, badings, favorites, origins, users }` (`badings` = les miens, anonymes compris) |
| `PATCH /me` | `{ pseudo?, firstName?, lastName?, bio? }` | `{ user }` (changer de pseudo retire le badge vérifié) |
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
| `GET /me/export` | — | `{ user, badings, liked, favorites, origins, comments, users }` (PDF « copie de mes données ») |

### Notifications

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `GET /notifications` | — | `{ notifications, users, badings, origins }` |
| `POST /notifications/read` | — | 204 |

## Reste dans le navigateur

- **Copie de mes données (PDF)** (`src/lib/export.js`) : générée dans le navigateur, après avoir chargé `GET /me/export`.
- **Brouillon** et **fin de l'onboarding** : restent volontairement dans le navigateur.

Les actions des cartes (rire, rebade, partage, favori, signalement, blocage, suppression) passent par le backend
depuis la version React : l'écran change tout de suite, puis revient en arrière si le serveur refuse.
