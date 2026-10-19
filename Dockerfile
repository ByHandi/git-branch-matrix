FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN NEXT_STANDALONE=1 npm run build

FROM node:22-alpine
# Repos are bind-mounted from the host, so their owner never matches the
# container user — without safe.directory git refuses to read them.
RUN apk add --no-cache git && git config --system safe.directory '*'
WORKDIR /app
ENV NODE_ENV=production PORT=4321 HOSTNAME=0.0.0.0
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 4321
CMD ["node", "server.js"]
