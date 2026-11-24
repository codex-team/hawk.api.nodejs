/**
 * Checks if provided uri is a loopback interface
 * @param uri uri to check
 * @returns 'true' if uri is valid, 'false' if uri is invalid
 */
export function isLoopback(uri: string): boolean {
  try {
    const hostname = new URL(uri).hostname
      .toLowerCase()
      // removes brackets around ipv6 loopback uri ([::1])
      .replace(/^\[|\]$/g, '');

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1'
    );
  } catch {
    return false;
  }
};
