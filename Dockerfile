FROM node:24.14.0

WORKDIR /app
COPY . ./

RUN apt-get update && apt-get install -y --no-install-recommends awscli tini && rm -rf /var/lib/apt/lists/*

RUN npm i -g clawchef openclaw@2026.3.2
RUN npm install
RUN npm run build

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
