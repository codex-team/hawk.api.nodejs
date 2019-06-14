const mongoose = require('mongoose');
const uuid = require('uuid');

require('./user');

const projectSchema = new mongoose.Schema(
  {
    token: {
      type: String
    },
    name: {
      type: String
    },
    description: {
      type: String
    },
    domain: {
      type: String
    },
    uri: {
      type: String
    },
    logo: {
      type: String
    },
    uidAdded: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: {
      createdAt: 'dtAdded'
    }
  }
);

// Generates unique token for project (mongodb's ids are predicatable)
projectSchema.pre('save', function (next) {
  if (!this.token) {
    this.token = uuid.v4();
  }

  return next();
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
