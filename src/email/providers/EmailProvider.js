const templates = require('../templates');
const mustache = require('mustache');

/**
 * @typedef {Object} EmailContent
 * @property {String} subject - email subject
 * @property {String} html - html content
 * @property {String} text - text content
 */

/**
 * Class representing base email provider
 * @abstract
 */
class EmailProvider {
  /**
   * Send email to specified receiver from template
   * @abstract
   * @param {string} to - email's receivers
   * @param {string} templateName - email's subject
   * @param {Object} [variables] - template variables
   */
  send(to, templateName, variables) {
  }

  /**
   * Render template with variables
   * @param {String} templateName - name of the template
   * @param {Object} [variables] - template variables
   * @return {EmailContent}
   */
  static render(templateName, variables) {
    const template = templates.content[templateName];

    Object.keys(template).forEach(key => {
      template[key] = mustache.render(template[key], variables);
    });
    return template;
  }
}

module.exports = EmailProvider;
