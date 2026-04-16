FROM node:24.14.0

ARG GITHUB_TOKEN

WORKDIR /app
COPY . ./

RUN apt-get update && apt-get install -y --no-install-recommends awscli git tini && rm -rf /var/lib/apt/lists/*

RUN npm i -g clawchef openclaw@2026.3.2
RUN test -n "$GITHUB_TOKEN" \
  && git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/0xLazAI/loomcli.git" /tmp/loomcli \
  && npm --prefix /tmp/loomcli install \
  && npm --prefix /tmp/loomcli link \
RUN npm install
RUN npm run build

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
