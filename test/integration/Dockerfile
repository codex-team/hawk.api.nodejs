FROM node:14.15.4-alpine3.11

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn

COPY . .

CMD ["yarn", "jest"]
