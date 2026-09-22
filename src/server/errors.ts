/**
 * Error de negocio con el status HTTP que le corresponde. Los servicios lo lanzan sin depender de
 * Next ni de HTTP; las rutas lo traducen con serviceErrorResponse y un worker puede capturarlo igual.
 */
export class ServiceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ServiceError";
  }
}
