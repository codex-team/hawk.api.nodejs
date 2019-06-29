const fs = require('fs');

/**
 * @type {Object} - contains email content (subject, text, html) for each template
 */
const templates = fs.readdirSync(__dirname)
  .filter(name => !name.endsWith('.js'))
  .reduce((accumulator, templateName) => {
    const templateDir = `${__dirname}/${templateName}/`;
    const templateContent = fs.readdirSync(templateDir);

    const subjectFilename = templateContent.find(fileName => fileName.startsWith('subject'));
    const htmlFilename = templateContent.find(fileName => fileName.startsWith('html'));
    const textFilename = templateContent.find(fileName => fileName.startsWith('text'));

    accumulator[templateName] = {
      subject: fs.readFileSync(templateDir + subjectFilename).toString(),
      html: fs.readFileSync(templateDir + htmlFilename).toString(),
      text: fs.readFileSync(templateDir + textFilename).toString()
    };
    return accumulator;
  }, {});

/**
 * @enum {String} - available template names
 */
const templateNames = {
  /**
   * Welcome letter with password
   * @var {String} email - user's email
   * @var {String} password - user's password
   */
  SUCCESSFUL_SIGN_UP: 'successful-sign-up'
};

module.exports = {
  content: templates,
  names: templateNames
};
