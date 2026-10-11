export class PaymentError extends Error {
  constructor(
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "PaymentError";
  }
}
