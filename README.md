# Kollek Party Game

This repository contains the realtime "Qui de nous" party game with the Express + Socket.IO backend and the neon-themed front-end used for Render deployment.

## Déployer et récupérer sur `main`

Pour que tes amis récupèrent les dernières modifications directement sur `main` depuis GitHub :

1. Assure-toi d'abord d'avoir cloné le dépôt puis place-toi dans le dossier :
   ```bash
   git clone <URL_DU_DEPOT>
   cd kollek
   ```
2. Vérifie que tu suis bien la branche `main` et mets-la à jour :
   ```bash
   git checkout main
   git pull origin main
   ```
3. Après avoir appliqué de nouveaux changements :
   ```bash
   git add .
   git commit -m "Ton message de commit"
   git push origin main
   ```

Si GitHub a une branche par défaut différente, change-la dans les paramètres du dépôt pour pointer vers `main`. Ainsi, un simple `git pull origin main` téléchargera exactement ce qui a été livré ici.

## Lancer en local

```bash
npm install
npm start
```

L'application écoute sur `http://localhost:3000`. Définis la variable d'environnement `ADMIN_PASSWORD` pour sécuriser l'accès admin avant de lancer le jeu.
