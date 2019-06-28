const fs = require('fs');

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

module.exports = templates;
