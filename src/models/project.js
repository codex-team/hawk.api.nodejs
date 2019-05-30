const mongoose = require('mongoose');
const crypto = require('crypto');

require('./user');

const ProjectSchema = new mongoose.Schema({
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
}, {
  timestamps: {
    createdAt: 'dtAdded'
  }
});

/**
 * Create unique token for project
 * @param {Project} project - project object
 * @param {Function} done - callback function
 * @returns
 */
ProjectSchema.statics.generateToken = async (project, done) => {
  let token, count;

  while (true) {
    token = crypto.randomBytes(64).toString('hex');

    try {
      count = await project.model('Project').countDocuments({ token: token });
    } catch (err) {
      return done(err);
    }

    if (!count) {
      project.token = token;
      return done();
    }
  }
};

ProjectSchema.pre('save', function (next) {
  console.log(this.name);
  if (this.token) {
    return next();
  }

  this.constructor.generateToken(this, next);
});

const Project = mongoose.model('Project', ProjectSchema);

module.exports = Project;
