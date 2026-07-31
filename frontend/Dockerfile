# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` demands the lock file match byte-for-byte, which keeps breaking
# here: some transitive deps (lightningcss/oxlint's WASM fallback packages)
# resolve differently depending on the OS/npm version that generated the
# lock file, so a lock committed from Windows can legitimately look "out of
# sync" to npm running in this Linux/arm64 image. `npm install` reconciles
# instead of demanding an exact match, which is what we actually want here.
RUN npm install
COPY . .

# Vite inlines VITE_* vars into the built JS at BUILD time, not runtime — so
# this has to arrive as a build-arg (docker-compose build.args), and the
# image must be rebuilt any time the backend's address changes.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- serve stage ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
