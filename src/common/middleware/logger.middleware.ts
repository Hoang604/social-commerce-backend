// src/common/middleware/logger.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction) {
    const { method, originalUrl, headers, body, ip } = request;
    const userAgent = request.get('user-agent') || '';

    const oldSend = response.send;
    const oldJson = response.json;
    let responseBody: any;

    // Intercept response.send
    response.send = function (data) {
      responseBody = data;
      return oldSend.apply(response, arguments);
    };

    // Intercept response.json
    response.json = function (data) {
      responseBody = data;
      return oldJson.apply(response, arguments);
    };

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');

      let responseBodyFormatted: any;
      try {
        // If responseBody is a string, try to parse it as JSON
        if (typeof responseBody === 'string') {
          responseBodyFormatted = JSON.parse(responseBody);
        } else if (responseBody !== undefined) {
          // If it's already an object, use it directly
          responseBodyFormatted = responseBody;
        } else {
          // If responseBody is undefined, check if it's a redirect or empty response
          responseBodyFormatted =
            statusCode >= 300 && statusCode < 400
              ? 'Redirect response'
              : 'Empty response';
        }
      } catch (e) {
        // If parsing fails, use the raw responseBody
        responseBodyFormatted = responseBody || 'Unable to parse response body';
      }

      // Log chi tiết request và response
      const logMessage = `
--------------------------------------------------
Request: ${method} ${originalUrl} from ${ip}
User-Agent: ${userAgent}
Headers: ${JSON.stringify(headers, null, 2)}
Body: ${body ? JSON.stringify(body, null, 2) : 'No body'}
--------------------------------------------------
Response:
Status: ${statusCode}
Content-Length: ${contentLength || 'Unknown'}
Headers: ${JSON.stringify(response.getHeaders(), null, 2)}
Body: ${responseBodyFormatted ? JSON.stringify(responseBodyFormatted, null, 2) : 'No response body'}
--------------------------------------------------`;

      if (statusCode >= 400) {
        this.logger.error(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
