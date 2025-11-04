# Hawk API

![License](https://img.shields.io/badge/license-BSL--1.1-orange)

## Start API
For deployment (both in production and in development), you can use Docker.
See Docker instructions [here](DOCKER.md).

Also you can run Hawk API manually:
- Start MongoDB
- Write necessary info to .env file
- Run `yarn start` or `yarn dev`
- Go to `localhost:4000/graphql`

## Schema

GraphQL API schema is located [here](src/typeDefs).

## GraphQL Playground
For queries testing you can enable GraphQL playground.
The corresponding setting is in the `.env` file (`PLAYGROUND_ENABLE`).
If the playground is turned on, you can access it via `/graphql` route.

To execute the request, enter it in the input field on the left and click on the request execution button.
On the right side you will see the result of the query.

## GraphQL Voyager
You can view API Schema visualization in `/voyager` page in your browser.
To see current production schema go to [here](https://api.beta.hawk.so/voyager)

## Migrations

Run `yarn migrations:up` command to apply migration revisions or
`yarn migrations:down` to rollback the last revision.

## License

Source code is available under **Business Source License 1.1 (BSL 1.1)**.
See [`LICENSE`](./LICENSE) for terms, including:
