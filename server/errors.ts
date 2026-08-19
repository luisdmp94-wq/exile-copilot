/**
 * Error HTTP de API: se traduce a `ApiError` JSON en el manejador de errores.
 */
export class ApiHttpError extends Error {
  readonly statusCode: number;
  readonly detail?: string;

  constructor(statusCode: number, error: string, detail?: string) {
    super(error);
    this.name = "ApiHttpError";
    this.statusCode = statusCode;
    if (detail !== undefined) this.detail = detail;
  }
}
