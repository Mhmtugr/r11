/**
 * Generates a unique order ID in the format #YYMM-RR
 * where YY is the last two digits of the year,
 * MM is the month (01-12),
 * and RR are two random uppercase letters.
 * @returns {string} The generated order ID
 */
export function generateOrderId() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  
  // Generate two random uppercase letters
  const getRandomChar = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const randomChars = getRandomChar() + getRandomChar();
  
  return `#${year}${month}-${randomChars}`;
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The input string.
 * @returns {string} The string with the first letter capitalized.
 */
export function capitalizeFirstLetter(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncates a string to a specified length and adds an ellipsis if needed.
 * @param {string} str - The input string.
 * @param {number} maxLength - The maximum length of the string.
 * @returns {string} The truncated string.
 */
export function truncateString(str, maxLength) {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

// Add other string utility functions if needed
