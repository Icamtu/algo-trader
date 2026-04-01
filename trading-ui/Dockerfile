FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy SvelteKit build output to /app/build for the node adapter
COPY --from=builder /app/build /app/build

EXPOSE 3000

CMD ["node", "build/index.js"]
