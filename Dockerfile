FROM node:24-bookworm-slim
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers

COPY package.json package-lock.json ./
RUN npm ci && npx playwright install --with-deps chromium --no-shell
COPY . .
RUN if [ -f src/main.tsx ]; then npm run build; else npm run build:server; fi \
    && mkdir -p /app/data \
    && chown -R node:node /app/data /opt/playwright-browsers

ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173
USER node
EXPOSE 4173
CMD ["npm", "start"]
