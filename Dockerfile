FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev

COPY server.js ./
COPY server-test-1sec.mp4 ./

ENV NODE_ENV=production

EXPOSE 10000

CMD ["npm", "start"]
