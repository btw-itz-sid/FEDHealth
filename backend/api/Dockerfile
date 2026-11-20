FROM node:22-alpine AS build
WORKDIR /app
COPY backend/api/package*.json ./
RUN npm ci
COPY backend/api/tsconfig*.json backend/api/nest-cli.json ./
COPY backend/api/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production API_PORT=3001 DATASET_UPLOAD_DIR=/app/data/uploads
WORKDIR /app
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
