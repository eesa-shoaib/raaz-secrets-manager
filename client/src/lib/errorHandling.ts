export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return (
    err instanceof ApiError ||
    (typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      'code' in err &&
      typeof (err as ApiError).status === 'number' &&
      typeof (err as ApiError).code === 'string')
  );
}

export function normalizeError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (typeof error === 'object' && error !== null && 'response' in error) {
    const axiosError = error as {
      response?: {
        status?: number;
        data?: {
          error?: {
            code?: string;
            message?: string;
          };
          message?: string;
        };
      };
      message?: string;
    };

    const status = axiosError.response?.status ?? 0;
    const responseData = axiosError.response?.data;
    const code =
      responseData?.error?.code ??
      (status === 0 ? 'NETWORK_ERROR' : status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL_ERROR');
    const message =
      responseData?.error?.message ??
      responseData?.message ??
      axiosError.message ??
      (status === 0 ? 'Network error — try again' : 'Something went wrong — the action was not applied');

    return new ApiError(status, code, message);
  }

  if (error instanceof Error) {
    return new ApiError(0, 'UNKNOWN_ERROR', error.message);
  }

  return new ApiError(0, 'UNKNOWN_ERROR', 'Something went wrong — the action was not applied');
}
