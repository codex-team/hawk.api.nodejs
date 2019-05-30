const mongoose = require('mongoose');

require('./user');
require('./project');

const WorkspaceSchema = new mongoose.Schema({
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

const Workspace = mongoose.model('Workspace', WorkspaceSchema);

module.exports = Workspace;
