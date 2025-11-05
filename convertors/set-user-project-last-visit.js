require('dotenv').config();
require('process');
const { MongoClient } = require('mongodb');

/**
 * Method that runs convertor script
 */
async function run() {
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

  const collections = await hawkDb.listCollections({}, {
    authorizedCollections: true,
    nameOnly: true,
  }).toArray();

  let usersInProjectCollectionsToCheck = collections.filter(col => /^users-in-project:/.test(col.name)).map(col => col.name);

  console.log(`Found ${usersInProjectCollectionsToCheck.length} users in project collections.`);

  const usersDocuments = await hawkDb.collection('users').find({}).toArray();

  // Convert events
  let i = 1;
  let documentsUpdatedCount = 1;

  for (const collectionName of usersInProjectCollectionsToCheck) {
    console.log(`[${i}/${usersInProjectCollectionsToCheck.length}] Processing ${collectionName}`);
      
    const usersInProject = await hawkDb.collection(collectionName).find({}).toArray();

    console.log(`Found ${usersInProject.length} users in project ${collectionName}.`);

    let usersUpdatedCount = 0;

    for (const userInProject of usersInProject) {
      const userDocument = usersDocuments.find(u => u._id.toString() === userInProject.userId.toString());
      if (userDocument) {
        const projectId = collectionName.split(':')[1];
        await hawkDb.collection('users').updateOne({ _id: userDocument._id }, { $set: { projectsLastVisit: { [projectId]: userInProject.timestamp } } });
        usersUpdatedCount++;
        console.log(`Updated ${usersUpdatedCount}/${usersInProject.length} users in project ${collectionName}.`);
      }
    }

    i++;
  }

  await client.close();
}

run().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});