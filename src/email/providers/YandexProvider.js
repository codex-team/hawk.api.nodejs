const nodemailer = require('nodemailer');
const EmailProvider = require('./EmailProvider');

/**
 * Class representing Yandex email service provider
 */
class YandexProvider extends EmailProvider {
  /**
   * Creates provider instance
   */
  constructor() {
    super();

    this.config = {
      host: process.env.YANDEX_MAIL_HOST,
      port: process.env.YANDEX_MAIL_PORT,
      secure: true,
      auth: {
        user: process.env.YANDEX_MAIL_USERNAME,
        pass: process.env.YANDEX_MAIL_PASSWORD
      }
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
    if (!templateName) throw new Error('Email\'s template name must be specified');

    const emailContent = YandexProvider.render(templateName, variables);

    const mailOptions = {
      from: `"${process.env.YANDEX_SENDER_NAME}" <${process.env.YANDEX_SENDER_ADDRESS}>`, // sender address
      to,
      ...emailContent
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (e) {
      console.log('Error sending letter. Try to check the environment settings (in .env file).');
    }
  }
}

module.exports = YandexProvider;
