import axios from 'axios';

const baseBotUrl = process.env.TELEGRAM_MAIN_CHAT_URL || '';
const moneyBotUrl = process.env.TELEGRAM_MONEY_CHAT_URL || '';

/**
 * Telegram bot URLs
 */
export enum TelegramBotURLs {
  /**
   * Hawk chat
   */
  Base = 'base',

  /**
   * Money integrations chat
   */
  Money = 'money'
}

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

  try {
    await axios.post(botUrl, `message=${encodeURIComponent(message)}&parse_mode=HTML`);
  } catch (err) {
    console.log('Couldn\'t send a message to Telegram', err);
  }
}
