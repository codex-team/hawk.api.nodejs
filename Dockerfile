FROM node:16.16-alpine3.15

WORKDIR /app

COPY .yarn .yarn
COPY package.json yarn.lock .yarnrc.yml .pnp.cjs .pnp.loader.mjs .yarnrc.yml tsconfig.json ./

RUN yarn rebuild

COPY index.ts .
COPY src ./src

RUN yarn compile

EXPOSE 3000

ENV NODE_ENV=production

CMD ["yarn", "node", "dist/index.js"]
