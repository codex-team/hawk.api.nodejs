const mongoose = require('mongoose');
const deepPopulate = require('mongoose-deep-populate')(mongoose);

require('./user');
require('./project');

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String
  },
  description: {
    type: String
  },
  image: {
    type: String,
    default: '' // @todo default image for workspace
  },
  // @todo make memeber type responsibe for permissions
  users: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  ],
  projects: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'Project'
    }
  ]
});

workspaceSchema.plugin(deepPopulate);

const Workspace = mongoose.model('Workspace', workspaceSchema);

module.exports = Workspace;
