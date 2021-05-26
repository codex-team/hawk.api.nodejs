# Hawk API integration tests

This folder contains integration tests for API.
All services and tests are started through docker.

Run following command from the project root to run the tests:
```
docker-compose -f docker-compose.test.yml up --exit-code-from tests tests
```
or via yarn:
```shell
yarn test:integration
```
