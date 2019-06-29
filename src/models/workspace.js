const mongoose = require('mongoose');
const deepPopulate = require('mongoose-deep-populate')(mongoose);

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
  }
});

workspaceSchema.plugin(deepPopulate);

const Workspace = mongoose.model('Workspace', workspaceSchema);

module.exports = Workspace;
