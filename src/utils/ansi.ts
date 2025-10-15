/**
 * ANSI escape codes for text formatting
 */
export enum Effect {
  Reset = '\x1b[0m',
  Bold = '\x1b[1m',
  Underline = '\x1b[4m',
  CrossedOut = '\x1b[9m',
  BoldOff = '\x1b[22m',
  UnderlineOff = '\x1b[24m',
  CrossedOutOff = '\x1b[29m',
  ForegroundRed = '\x1b[31m',
  ForegroundGreen = '\x1b[32m',
  ForegroundYellow = '\x1b[33m',
  ForegroundBlue = '\x1b[34m',
  ForegroundMagenta = '\x1b[35m',
  ForegroundCyan = '\x1b[36m',
  ForegroundWhite = '\x1b[37m',
  ForegroundGray = '\x1b[90m',
  BackgroundRed = '\x1b[41m',
  BackgroundGreen = '\x1b[42m',
  BackgroundYellow = '\x1b[43m',
  BackgroundBlue = '\x1b[44m',
  BackgroundMagenta = '\x1b[45m',
  BackgroundCyan = '\x1b[46m',
  BackgroundWhite = '\x1b[47m',
  BackgroundGray = '\x1b[100m',
};

/**
 * ANSI escape code for setting visual effects using SGR (Select Graphic Rendition) subset
 *
 * @example console.log('Hello, ${sgr('world', Effect.ForegroundRed)}');
 *
 *
 * @param message - The message to colorize
 * @param color - The color to apply
 * @returns The colored message
 */
export function sgr(message: string, color: Effect | Effect[]): string {
  const colorCode = Array.isArray(color) ? color.join('') : color ?? Effect.Reset;

  return `${colorCode}${message}${Effect.Reset}`;
}
