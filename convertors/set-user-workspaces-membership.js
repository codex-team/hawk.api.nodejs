require('dotenv').config();
require('process');
const { setup } = require('./setup');

/**
 * Method that runs convertor script
 */
async function run() {
    const { client, hawkDb } = await setup();

    const collections = await hawkDb.listCollections({}, {
        authorizedCollections: true,
        nameOnly: true,
    }).toArray();

    let usersMembershipCollectionsToCheck = collections.filter(col => /^membership:/.test(col.name)).map(col => col.name);

    console.log(`Found ${usersMembershipCollectionsToCheck.length} users membership collections.`);

    const usersDocuments = await hawkDb.collection('users').find({}).toArray();

    // Convert events
    let i = 1;

    for (const collectionName of usersMembershipCollectionsToCheck) {
        console.log(`[${i}/${usersMembershipCollectionsToCheck.length}] Processing ${collectionName}`);

        const userId = collectionName.split(':')[1];

        const userDocument = usersDocuments.find(u => u._id.toString() === userId);

        const memberships = await hawkDb.collection(collectionName).find({}).toArray();

        for (const membership of memberships) {
            const workspaceId = membership.workspaceId.toString();
            const isPending = membership.isPending || false;
            await hawkDb.collection('users').updateOne({ _id: userDocument._id }, { $set: { [`workspaces.${workspaceId}`]: { isPending } } });
        }

        i++;
    }

    await client.close();
}

run().catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
});