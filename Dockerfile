FROM node:8-alpine

LABEL org.opencontainers.image.source https://github.com/HuggableSquare/stitcherss

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install --production --frozen-lockfile

COPY . .

CMD ["node", "index.js"]
