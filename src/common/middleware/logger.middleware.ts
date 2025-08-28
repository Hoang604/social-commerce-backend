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
    let responseBody: any;
    response.send = function (data) {
      responseBody = data;
      return oldSend.apply(response, arguments);
    };

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');

      let responseBodyFormatted: any;
      try {
        responseBodyFormatted = JSON.parse(responseBody);
      } catch (e) {
        responseBodyFormatted = responseBody;
      }

      // Log chi tiết request và response
      const logMessage = `
--------------------------------------------------
Request: ${method} ${originalUrl} from ${ip}
User-Agent: ${userAgent}
Headers: ${JSON.stringify(headers, null, 2)}
Body: ${JSON.stringify(body, null, 2)}
--------------------------------------------------
Response:
Status: ${statusCode}
Content-Length: ${contentLength}
Headers: ${JSON.stringify(response.getHeaders(), null, 2)}
Body: ${JSON.stringify(responseBodyFormatted, null, 2)}
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
