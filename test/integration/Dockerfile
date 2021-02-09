FROM node:14.15.4-alpine3.11

WORKDIR /usr/src/app/

RUN apk add git

COPY package.json yarn.lock ./

RUN yarn

WORKDIR /usr/src/app/test/integration/

COPY /test/integration/package.json ./
COPY /test/integration/yarn.lock ./

RUN yarn

WORKDIR /usr/src/app/

COPY . .

RUN apk add --no-cache openssl

ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz

WORKDIR /usr/src/app/test/integration/

CMD ["yarn", "jest"]
