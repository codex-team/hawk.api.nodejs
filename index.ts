import Fastify from 'fastify';
const fastify = Fastify({
  logger: true,
});

fastify.get('/', function (_request, reply) {
  reply.send({ hello: 'world' });
});

// Run the server!
fastify.listen({ port: 3000,
  host: '0.0.0.0' }, function (err) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  // Server is now listening on ${address}
});

console.log('hello!');
