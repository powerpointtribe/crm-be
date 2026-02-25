import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Performance Logging Interceptor
 * Logs the response time for each API request
 * Helps identify slow endpoints that need optimization
 */
@Injectable()
export class PerformanceLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('API Performance');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const logLevel = this.getLogLevel(duration);

          const message = `${method} ${url} - ${duration}ms`;

          // Log based on duration thresholds
          if (logLevel === 'warn') {
            this.logger.warn(`⚠️  SLOW: ${message}`);
          } else if (logLevel === 'error') {
            this.logger.error(`🔴 VERY SLOW: ${message}`);
          } else if (duration > 100) {
            this.logger.log(`⏱️  ${message}`);
          }
          // Don't log fast requests (< 100ms) to reduce noise
        },
        error: () => {
          const duration = Date.now() - start;
          this.logger.error(`❌ ERROR: ${method} ${url} - ${duration}ms`);
        },
      }),
    );
  }

  private getLogLevel(duration: number): 'log' | 'warn' | 'error' {
    if (duration > 2000) return 'error'; // Very slow: > 2 seconds
    if (duration > 1000) return 'warn';  // Slow: > 1 second
    return 'log'; // Normal
  }
}
