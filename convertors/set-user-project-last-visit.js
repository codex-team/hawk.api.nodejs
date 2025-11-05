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

    let usersInProjectCollectionsToCheck = collections.filter(col => /^users-in-project:/.test(col.name)).map(col => col.name);

    console.log(`Found ${usersInProjectCollectionsToCheck.length} users in project collections.`);

    const usersDocuments = await hawkDb.collection('users').find({}).toArray();

    // Convert events
    let i = 1;

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