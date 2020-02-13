const fs = require('fs');

/**
 * @type {Object.<string, EmailContent>} - contains email content (subject, text, html) for each template
 */
const templates = fs
  .readdirSync(__dirname) // read templates directory
  .filter(name => !name.endsWith('.js')) // leave only template folders
  .reduce((accumulator, templateName) => {
    const templateDir = `${__dirname}/${templateName}/`;
    const templateContent = fs.readdirSync(templateDir);

    // go to each folder and find the template files
    const subjectFilename = templateContent.find(fileName =>
      fileName.startsWith('subject')
    );
    const htmlFilename = templateContent.find(fileName =>
      fileName.startsWith('html')
    );
    const textFilename = templateContent.find(fileName =>
      fileName.startsWith('text')
    );

    // write content of the template files to the object
    accumulator[templateName] = {
      subject: fs.readFileSync(templateDir + subjectFilename).toString(),
      html: fs.readFileSync(templateDir + htmlFilename).toString(),
      text: fs.readFileSync(templateDir + textFilename).toString(),
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
  SUCCESSFUL_SIGN_UP: 'successful-sign-up',
  PASSWORD_RESET: 'password-reset',
  WORKSPACE_INVITE: 'workspace-invite',
};

module.exports = {
  content: templates,
  names: templateNames,
};
