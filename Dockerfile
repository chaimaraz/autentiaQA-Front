# Étape 1 : Builder l'application
FROM node:20-alpine AS builder

# Définir le répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install --ignore-scripts

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

# Nginx tourne en non-root (utilisateur "nginx" déjà présent dans l'image) :
# écoute sur un port non privilégié (voir nginx.conf) + dossiers d'exécution
# réattribués (root ne conserve que le build, jamais le service HTTP).
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid
USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
