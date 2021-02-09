import axios from 'axios';

const botUrl = process.env.TELEGRAM_BOT_URL;

/**
 * Send a message to telegram via notify-codex-bot
 *
 * @param message - message to send
 */
export async function sendMessage(message: string): Promise<void> {
  if (!botUrl) {
    return;
  }

  await axios.post(botUrl, `message=${encodeURIComponent(message)}&parse_mode=HTML`);
}

module.exports = {
  sendMessage,
};