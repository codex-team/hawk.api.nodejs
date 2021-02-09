import axios from 'axios';
import { TelegramBotURLs } from '../types/bgTasks';

const baseBotUrl = process.env.TELEGRAM_BASE_URL || '';
const moneyBotUrl = process.env.TELEGRAM_MONEY_URL || '';

/**
 * Send a message to telegram via notify-codex-bot
 *
 * @param message - message to send
 * @param chat - chat to send the message
 */
export async function sendMessage(message: string, chat = TelegramBotURLs.Base): Promise<void> {
  let botUrl = '';

  switch (chat) {
    case TelegramBotURLs.Base: botUrl = baseBotUrl; break;
    case TelegramBotURLs.Money: botUrl = moneyBotUrl; break;
    default: botUrl = baseBotUrl; break;
  }

  if (!botUrl) {
    return;
  }

  await axios.post(botUrl, `message=${encodeURIComponent(message)}&parse_mode=HTML`);
}

module.exports = {
  sendMessage,
};