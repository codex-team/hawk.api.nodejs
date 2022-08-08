ARG NODE_IMAGE=node:16.16-alpine3.15

FROM $NODE_IMAGE as prod-deps

WORKDIR /app

COPY .yarn .yarn
COPY package.json yarn.lock .yarnrc.yml ./

RUN yarn workspaces focus --production


FROM $NODE_IMAGE as builder

WORKDIR /app

COPY .yarn .yarn
COPY package.json yarn.lock .yarnrc.yml ./
COPY --from=prod-deps /app/node_modules ./node_modules

RUN yarn install --frozen-lockfile

COPY tsconfig.json tsconfig.json

COPY . .

RUN yarn compile

FROM $NODE_IMAGE

WORKDIR /app

COPY package.json package.json
COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules

EXPOSE 4000

ENV NODE_ENV=production

ENTRYPOINT ["node", "./dist/index.js"]
CMD ["-c", "app-config.yaml"]
