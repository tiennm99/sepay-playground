/**
 * @typedef {'pending' | 'paid' | 'expired'} OrderStatus
 *
 * @typedef {object} Order
 * @property {string} code         Public order code (e.g. SEVQR7K3QX9). Also QR memo.
 * @property {number} amount       VND, integer >= 1000.
 * @property {OrderStatus} status
 * @property {string} createdAt    ISO timestamp.
 * @property {string} [paidAt]     ISO timestamp when status flipped to paid.
 * @property {string} [txReference] SePay referenceCode of the matching transaction.
 *
 * @typedef {object} SepayWebhookPayload
 * @property {number} id
 * @property {string} gateway
 * @property {string} transactionDate
 * @property {string} accountNumber
 * @property {string|null} code
 * @property {string} content
 * @property {'in'|'out'} transferType
 * @property {number} transferAmount
 * @property {number} accumulated
 * @property {string|null} subAccount
 * @property {string} referenceCode
 * @property {string} description
 */

export {};
