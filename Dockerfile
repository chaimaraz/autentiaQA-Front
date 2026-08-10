# Étape 1 : Builder l'application
FROM node:20-alpine AS builder

# Définir le répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier tout le code
COPY . .

# Build production Angular
RUN npm run build --prod

# Étape 2 : Servir avec Nginx
FROM nginx:alpine

# Copier les fichiers buildés depuis le builder
COPY --from=builder /app/dist/autentia-front/browser /usr/share/nginx/html

# Copier le fichier de configuration Nginx (optionnel)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exposer le port
EXPOSE 80

# Démarrer Nginx
CMD ["nginx", "-g", "daemon off;"]
