# syntax=docker/dockerfile:1

# Imagen de producción para la PWA estática CONSTRURAMSA Control de Obra.
# No requiere compilación ni dependencias de ejecución: server.js sirve los
# archivos estáticos del repositorio (index.html, src/, vendor/, PWA assets).
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --chown=node:node . .

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
