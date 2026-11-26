/**
 * Error de negocio con el status HTTP que le corresponde. Los servicios lo lanzan sin depender de
 * Next ni de HTTP; las rutas lo traducen con serviceErrorResponse y un worker puede capturarlo igual.
 */
export class ServiceError extends Error {
  readonly status: number;
  /** Identificador estable opcional para que la pantalla reaccione (p. ej. "PRICE_CHANGED"). */
  readonly code?: string;

  // Sin propiedades en el constructor: así Node corre las pruebas solo quitando los tipos.
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
    this.code = code;
  }
}
