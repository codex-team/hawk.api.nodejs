const { MongoClient } = require('mongodb');

async function setup() {
    const fullUri = process.env.MONGO_HAWK_DB_URL;

    // Parse the Mongo URL manually
    const mongoUrl = new URL(fullUri);
    const hawkDatabaseName = 'hawk';

    // Extract query parameters
    const queryParams = Object.fromEntries(mongoUrl.searchParams.entries());

    // Compose connection options manually
    const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        authSource: queryParams.authSource || 'admin',
        replicaSet: queryParams.replicaSet || undefined,
        tls: queryParams.tls === 'true',
        tlsInsecure: queryParams.tlsInsecure === 'true',
        // connectTimeoutMS: 3600000,
        // socketTimeoutMS: 3600000,
    };

    // Remove query string from URI
    mongoUrl.search = '';
    const cleanUri = mongoUrl.toString();

    console.log('Connecting to:', cleanUri);
    console.log('With options:', options);

    const client = new MongoClient(cleanUri, options);

    await client.connect();
    const hawkDb = client.db(hawkDatabaseName);

    console.log(`Connected to database: ${hawkDatabaseName}`);

    return { client, hawkDb };
}

module.exports = { setup };


