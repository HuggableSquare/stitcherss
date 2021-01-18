FROM node:8

LABEL org.opencontainers.image.source https://github.com/HuggableSquare/stitcherss

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn

COPY . .

CMD ["node", "index.js"]
