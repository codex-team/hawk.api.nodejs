const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: {
    type: String
  }
});

const Project = mongoose.model('Project', ProjectSchema);

module.exports = {
  Project
};
