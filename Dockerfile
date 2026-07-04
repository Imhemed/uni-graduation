# Higher Education Finance System — frontend (Astro static site behind nginx).

# ---- Build stage: compile the Astro static site ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Build for ROOT hosting so nginx serves it at "/".
ENV PUBLIC_BASE_PATH=/
RUN npm run build

# ---- Serve stage: nginx serves the build and proxies /api → the api service ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# The official nginx image runs executable scripts in /docker-entrypoint.d/ before
# starting nginx — use it to write the runtime config.json from $API_BASE_URL.
COPY docker-entrypoint.sh /docker-entrypoint.d/40-config-json.sh
RUN chmod +x /docker-entrypoint.d/40-config-json.sh
EXPOSE 80
