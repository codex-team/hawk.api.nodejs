const nodemailer = require('nodemailer');
const EmailProvider = require('./EmailProvider');

/**
 * Class representing any SMTP email service
 */
class SMTPProvider extends EmailProvider {
  /**
   * Creates provider instance
   */
  constructor() {
    super();

    this.config = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    };

    /**
     * Init transporter with date from config
     */
    this.transporter = nodemailer.createTransport(this.config);
  }

  /**
   * Send email to specified receiver from template
   * @param {string} to - email's receivers
   * @param {string} templateName - email's subject
   * @param {Object} [variables] - template variables
   */
  async send(to, templateName, variables) {
    if (!templateName) {
      throw new Error("Email's template name must be specified");
    }

    const emailContent = SMTPProvider.render(templateName, variables);

    const mailOptions = {
      from: `"${process.env.SMTP_SENDER_NAME}" <${
        process.env.SMTP_SENDER_ADDRESS
      }>`, // sender address
      to,
      ...emailContent,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(emailContent);
    }

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (e) {
      console.error(
        'Error sending letter. Try to check the environment settings (in .env file).'
      );
    }
  }
}

module.exports = SMTPProvider;
