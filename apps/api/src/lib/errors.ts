/** Email delivery failure — distinct from DB/auth errors so routes can handle it separately. */
export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailDeliveryError'
  }
}
