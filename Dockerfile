FROM node:24.14.0

WORKDIR /app
COPY . ./

RUN apt-get update && apt-get install -y --no-install-recommends awscli git tini unzip && rm -rf /var/lib/apt/lists/*

RUN npm i -g clawchef openclaw@2026.3.2
RUN git clone --depth 1 "https://github.com/0xLazAI/loomcli.git" /tmp/loomcli \
  && cd /tmp/loomcli \
  && npm i -g
RUN npm install
RUN npm run build

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
