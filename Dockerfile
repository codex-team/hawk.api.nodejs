FROM node:16.16-alpine3.15

WORKDIR /app

COPY .yarn .yarn
COPY package.json yarn.lock .yarnrc.yml .pnp.cjs .pnp.loader.mjs .yarnrc.yml tsconfig.json ./

COPY index.ts .

RUN yarn compile

EXPOSE 3000

CMD ["yarn", "node", "dist/index.js"]
