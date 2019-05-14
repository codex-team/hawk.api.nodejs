# Hawk API

## Schema

GraphQL API schema is located [here](src/typeDefs.js)

## Queries

- **health**

Healthcheck endpoint

Request:

```graphql
{
  health
}
```

Response:

```json
{
  "data": {
    "health": "ok"
  }
}
```

- **me**

Returns authenticated user data

Request:

```graphql
{
  me {
    id
    email
    name
    picture
  }
}
```

Response:

```json
{
  "data": {
    "me": {
      "id": "5cdafcbcef16984dde1ad6ff",
      "email": "me@example.com",
      "name": null,
      "picture": ""
    }
  }
}
```

## Mutations

- **register**

Register user with provided email and password

Returns `true` if registred

Request:

```graphql
mutation {
  register(email: "me@example.com", password: "example")
}
```

Response:

```json
{
  "data": {
    "register": true
  }
}
```

- **login**

Login user with provided email and password

Returns JWT access token

Request:

```graphql
mutation {
  login(email: "me@example.com", password: "exmaple")
}
```

Response:

```json
{
  "data": {
    "login": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1Y2RhZmNiY2VmMTY5ODRkZGUxYWQ2ZmYiLCJpYXQiOjE1NTc4NTU0MzMsImV4cCI6MTU1Nzk0MTgzM30.4EuqAL8SUddZ4oy6--gXvcJohTDnAc1Gq5U5CTFjJ1I"
  }
}
```
