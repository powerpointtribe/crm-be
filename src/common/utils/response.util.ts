export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

export interface ApiError {
  success: false;
  message: string;
  error?: any;
  timestamp: string;
}

export class ResponseUtil {
  static success<T>(data?: T, message: string = 'Success'): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  static error(message: string, error?: any): ApiError {
    return {
      success: false,
      message,
      error,
      timestamp: new Date().toISOString(),
    };
  }
}
