/**
 * @file Remove hardcoded image URL prefix
 */
 
function removePrefix(collection) {
  collection.forEach(function( dcmt ) {
    newImg = dcmt.image.replace("https://api.hawk.so/uploads/", "/uploads/");
    projects.updateOne(
      { _id: dcmt._id }, 
      { "$set": { "image": newImg } }
    );
  });
}

function addPrefixBack(collection) {
  collection.forEach(function( dcmt ) {
    newImg = "https://api.hawk.so" + dcmt.image;
    projects.updateOne(
      { _id: dcmt._id }, 
      { "$set": { "image": newImg } }
    );
  });
}
 
module.exports = {
  async up(db) {
    /**
     * Images are hardcoded in projects, users and workspaces
     */
    var projects = db.collection('projects').find({image:{$ne: null}});
    var users = db.collection('users').find({image:{$ne: null}});
    var workspaces = db.collection('workspaces').find({image:{$ne: null}});
    
    removePrefix(projects);
    removePrefix(users);
    removePrefix(workspaces);
  },

  async down(db) {
    /**
     * Images are hardcoded in projects, users and workspaces
     */
    var projects = db.collection('projects').find({image:{$ne: null}});
    var users = db.collection('users').find({image:{$ne: null}});
    var workspaces = db.collection('workspaces').find({image:{$ne: null}});
    
    addPrefixBack(projects);
    addPrefixBack(users);
    addPrefixBack(workspaces);
  },
};
