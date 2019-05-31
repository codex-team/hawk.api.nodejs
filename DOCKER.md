# Docker support

## Development

Development docker image supports live reload

`.env` variables are is separete file `.env.dev`

Run to get started:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

To rebuild the image and run it:

```bash
docker-compose up -f docker-compose.dev.yml -d --build
```

## Production

`NODE_ENV` is set to `production`

`devDependencies` are not downloaded

Run to get started:

```bash
docker-compose up -f docker-compose.prod.yml -d
```

To rebuild the image and run it:

```bash
docker-compose up -f docker-compose.prod.yml -d --build
```

## MongoDB

MongoDB container data is stored in `mongodata` volume

Run this to delete volume and containers:

```bash
docker-compose -f docker-compose.{dev,prod}.yml down
```

If you want to remove dangling volume run:

```bash
docker volume ls | grep mongodata | awk '{print $2}' | xargs docker volume rm
```
