/**
 * Error de negocio con el status HTTP que le corresponde. Los servicios lo lanzan sin depender de
 * Next ni de HTTP; las rutas lo traducen con serviceErrorResponse y un worker puede capturarlo igual.
 */
export class ServiceError extends Error {
  /** `code`: identificador estable opcional para que la pantalla reaccione (p. ej. "PRICE_CHANGED"). */
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
    this.name = "ServiceError";
  }
}
