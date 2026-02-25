import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Simple authentication middleware for Bull Board dashboard
 * Checks for valid JWT token in Authorization header
 *
 * For production, consider:
 * - IP whitelist
 * - Basic auth with strong credentials
 * - Integration with existing JWT auth
 */
export function createBullBoardAuthMiddleware(configService: ConfigService) {
  // In development, optionally allow without auth
  const isDevelopment = configService.get('NODE_ENV') !== 'production';
  const requireAuth = configService.get('REQUIRE_BULL_BOARD_AUTH', 'true') === 'true';

  // Allow bypass in development if configured
  if (isDevelopment && !requireAuth) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // Check for Authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Unauthorized - Bull Board access requires authentication',
        error: 'Unauthorized',
      });
    }

    // Extract token (in a real scenario, validate it properly)
    const token = authHeader.substring(7);

    // Basic token presence check
    // Note: For production, integrate with JwtService to validate token
    if (!token || token.length < 10) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Invalid authentication token',
        error: 'Unauthorized',
      });
    }

    // Token validation would go here
    // For now, we just check if a token is present
    // TODO: Integrate with JwtService to validate token and check for admin permissions

    next();
  };
}

/**
 * Alternative: Basic Auth middleware for Bull Board
 * More suitable for development/staging environments
 */
export function createBullBoardBasicAuthMiddleware(
  username: string,
  password: string,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
      return res.status(401).json({
        statusCode: 401,
        message: 'Authentication required',
        error: 'Unauthorized',
      });
    }

    const base64Credentials = authHeader.substring(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [user, pass] = credentials.split(':');

    if (user === username && pass === password) {
      return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
    return res.status(401).json({
      statusCode: 401,
      message: 'Invalid credentials',
      error: 'Unauthorized',
    });
  };
}
