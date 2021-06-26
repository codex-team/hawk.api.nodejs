/**
 * @file Remove hardcoded image URL prefix
 */
 
require('dotenv').config({
  path: '../.env',
});
 
module.exports = {
  async up(db, client) {
    async function removePrefix(collection) {
      const documents = await collection.find({image:{$ne: null}}).toArray();
      const operations = documents.map(dcmt => {
        newImg = dcmt.image.replace(/https?:\/\/[a-zA-Z0-9.]+\/uploads\//, "/uploads/");
        return {
          updateOne: {
            filter: {
              _id: dcmt._id
            },
            update: {
              $set: {
                "image": newImg
              }
            }
          }
        }
      });
      await collection.bulkWrite(operations);
    }
    /**
     * Images are hardcoded in projects, users and workspaces
     */
    await removePrefix(db.collection('projects'));
    await removePrefix(db.collection('users'));
    await removePrefix(db.collection('workspaces'));
  },

  async down(db) {
    async function addPrefixBack(collection) {
      const documents = await collection.find({image:{$ne: null}}).toArray();
      const operations = documents.map(dcmt => {
        if (!dcmt.image.match(/https?:\/\/[a-zA-Z0-9.]+\/uploads\/\S+/)) {
          dcmt.image = process.env.API_URL + dcmt.image;
        }
        return {
          updateOne: {
            filter: {
              _id: dcmt._id
            },
            update: {
              $set: {
                "image": dcmt.image
              }
            }
          }
        }
      });
      await collection.bulkWrite(operations);
    }
    /**
     * Images are hardcoded in projects, users and workspaces
     */
    await addPrefixBack(db.collection('projects'));
    await addPrefixBack(db.collection('users'));
    await addPrefixBack(db.collection('workspaces'));
  },
};
