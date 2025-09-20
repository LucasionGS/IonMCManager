interface ErrorReportData {
  message: string;
  stackTrace?: string;
  url?: string;
  userAgent?: string;
  userInfo?: Record<string, unknown>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  errorCode?: string;
}

class ErrorReportingService {
  private static instance: ErrorReportingService;
  private baseUrl: string;
  private authToken: string | null = null;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || '/api';
    this.setupGlobalErrorHandlers();
  }

  public static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  /**
   * Set authentication token for error reporting
   */
  public setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  /**
   * Setup global error handlers for unhandled errors
   */
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError({
        message: event.message || 'Unknown error',
        stackTrace: event.error?.stack,
        url: event.filename || window.location.href,
        userAgent: navigator.userAgent,
        severity: 'medium',
        errorCode: 'UNCAUGHT_ERROR',
        userInfo: {
          line: event.lineno,
          column: event.colno,
          timestamp: new Date().toISOString()
        }
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stackTrace: event.reason?.stack || 'No stack trace available',
        url: window.location.href,
        userAgent: navigator.userAgent,
        severity: 'high',
        errorCode: 'UNHANDLED_REJECTION',
        userInfo: {
          reason: event.reason,
          timestamp: new Date().toISOString()
        }
      });
    });
  }

  /**
   * Report an error to the server
   */
  public async reportError(errorData: ErrorReportData): Promise<void> {
    try {
      const payload = {
        message: errorData.message,
        stackTrace: errorData.stackTrace,
        source: 'client' as const,
        severity: errorData.severity || 'medium',
        url: errorData.url || window.location.href,
        userAgent: errorData.userAgent || navigator.userAgent,
        userInfo: {
          ...errorData.userInfo,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          screen: {
            width: window.screen.width,
            height: window.screen.height
          }
        },
        errorCode: errorData.errorCode
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.authToken) {
        headers.Authorization = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${this.baseUrl}/errors/log`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.warn('Failed to report error to server:', response.statusText);
      }
    } catch (error) {
      // Avoid infinite loop by not reporting errors that occur during error reporting
      console.warn('Failed to report error to server:', error);
    }
  }

  /**
   * Report a manual error with additional context
   */
  public async reportManualError(
    error: Error,
    context: {
      severity?: 'low' | 'medium' | 'high' | 'critical';
      userInfo?: Record<string, unknown>;
      errorCode?: string;
    } = {}
  ): Promise<void> {
    await this.reportError({
      message: error.message,
      stackTrace: error.stack,
      severity: context.severity || 'medium',
      userInfo: context.userInfo,
      errorCode: context.errorCode
    });
  }

  /**
   * Report a critical error that should be addressed immediately
   */
  public async reportCriticalError(
    message: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.reportError({
      message,
      severity: 'critical',
      userInfo: details,
      errorCode: 'CRITICAL_ERROR'
    });
  }

  /**
   * Report an API error with request details
   */
  public async reportApiError(
    error: Error,
    requestDetails: {
      url: string;
      method: string;
      statusCode?: number;
      responseText?: string;
    }
  ): Promise<void> {
    await this.reportError({
      message: `API Error: ${error.message}`,
      stackTrace: error.stack,
      severity: this.getApiErrorSeverity(requestDetails.statusCode),
      errorCode: `API_ERROR_${requestDetails.statusCode || 'UNKNOWN'}`,
      userInfo: {
        requestUrl: requestDetails.url,
        requestMethod: requestDetails.method,
        statusCode: requestDetails.statusCode,
        responseText: requestDetails.responseText?.substring(0, 1000) // Limit response text
      }
    });
  }

  /**
   * Determine severity based on HTTP status code
   */
  private getApiErrorSeverity(statusCode?: number): 'low' | 'medium' | 'high' | 'critical' {
    if (!statusCode) return 'medium';

    if (statusCode >= 500) return 'critical';
    if (statusCode === 403 || statusCode === 401) return 'high';
    if (statusCode >= 400) return 'low';
    
    return 'medium';
  }
}

// Export singleton instance
export const errorReportingService = ErrorReportingService.getInstance();
export default errorReportingService;