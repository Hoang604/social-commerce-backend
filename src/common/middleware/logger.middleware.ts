// src/common/middleware/logger.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  // ANSI color codes for terminal output
  private readonly colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
  };

  private colorize(text: string, color: string): string {
    return `${color}${text}${this.colors.reset}`;
  }

  private colorizeMethod(method: string): string {
    switch (method) {
      case 'GET':
        return this.colorize(method, this.colors.green);
      case 'POST':
        return this.colorize(method, this.colors.cyan);
      case 'PUT':
        return this.colorize(method, this.colors.yellow);
      case 'PATCH':
        return this.colorize(method, this.colors.yellow);
      case 'DELETE':
        return this.colorize(method, this.colors.red);
      default:
        return this.colorize(method, this.colors.white);
    }
  }

  private colorizeStatus(statusCode: number): string {
    const statusStr = statusCode.toString();
    if (statusCode >= 500) {
      return this.colorize(statusStr, this.colors.red);
    }
    if (statusCode >= 400) {
      return this.colorize(statusStr, this.colors.yellow);
    }
    if (statusCode >= 300) {
      return this.colorize(statusStr, this.colors.cyan);
    }
    if (statusCode >= 200) {
      return this.colorize(statusStr, this.colors.green);
    }
    return this.colorize(statusStr, this.colors.gray);
  }

  private getStatusText(statusCode: number): string {
    const statusTexts: { [key: number]: string } = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return statusTexts[statusCode] || 'Unknown Status';
  }

  private formatObjectForLog(obj: any, prefix: string): string[] {
    if (!obj || Object.keys(obj).length === 0) {
      return [this.colorize(`${prefix}(empty)`, this.colors.dim)];
    }

    if (typeof obj === 'string') {
      return [this.colorize(`${prefix}${obj}`, this.colors.dim)];
    }

    const lines: string[] = [];
    try {
      const formatted = JSON.stringify(obj, null, 2);
      const jsonLines = formatted.split('\n');
      jsonLines.forEach((line) => {
        if (line.trim()) {
          lines.push(this.colorize(`${prefix}${line}`, this.colors.dim));
        }
      });
    } catch (error) {
      lines.push(
        this.colorize(
          `${prefix}(unable to format: ${String(obj)})`,
          this.colors.red
        )
      );
    }
    return lines;
  }

  use(request: Request, response: Response, next: NextFunction) {
    const { method, originalUrl, headers, body, ip } = request;
    const userAgent = request.get('user-agent') || '';

    const oldSend = response.send;
    const oldJson = response.json;
    let responseBody: any;

    // Intercept response.send to capture the body
    response.send = function (data) {
      responseBody = data;
      return oldSend.apply(response, arguments);
    };

    // Intercept response.json to capture the body
    response.json = function (data) {
      responseBody = data;
      return oldJson.apply(response, arguments);
    };

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');

      let responseBodyFormatted: any;
      try {
        if (typeof responseBody === 'string') {
          responseBodyFormatted = JSON.parse(responseBody);
        } else if (responseBody !== undefined) {
          responseBodyFormatted = responseBody;
        } else {
          responseBodyFormatted =
            statusCode >= 300 && statusCode < 400
              ? 'Redirect response'
              : 'Empty response';
        }
      } catch (e) {
        responseBodyFormatted = responseBody || 'Unable to parse response body';
      }

      const timestamp = new Date().toISOString();
      const duration = Date.now() - (request['startTime'] || Date.now());

      const c = (text: string, color: string) => this.colorize(text, color);
      const gray = (text: string) => c(text, this.colors.gray);
      const dim = (text: string) => c(text, this.colors.dim);
      const bright = (text: string) => c(text, this.colors.bright);

      const logMessage = [
        '',
        gray('┌' + '─'.repeat(65)),
        `${gray('│')} ${bright(`[${timestamp}]`)} ${bright(
          'HTTP Request Completed'
        )}`,
        gray('├' + '─'.repeat(65)),
        `${gray('│')} ${this.colorizeMethod(method.padEnd(6))} ${originalUrl}`,
        `${gray('│')} Status: ${this.colorizeStatus(
          statusCode
        )} ${this.getStatusText(statusCode)}`,
        `${gray('│')} IP: ${ip}`,
        `${gray('│')} Duration: ${duration}ms`,
        `${gray('│')} Content-Length: ${contentLength || 'Unknown'}`,
        gray('├' + '─'.repeat(65)),
        `${gray('│')} ${bright('REQUEST DETAILS:')}`,
        `${gray('│')} User-Agent: ${dim(userAgent)}`,
        `${gray('│')} Headers:`,
        ...this.formatObjectForLog(headers, gray('│') + '   '),
        `${gray('│')} Body:`,
        ...this.formatObjectForLog(body || {}, gray('│') + '   '),
        gray('├' + '─'.repeat(65)),
        `${gray('│')} ${bright('RESPONSE DETAILS:')}`,
        `${gray('│')} Headers:`,
        ...this.formatObjectForLog(response.getHeaders(), gray('│') + '   '),
        `${gray('│')} Body:`,
        ...this.formatObjectForLog(
          responseBodyFormatted || {},
          gray('│') + '   '
        ),
        gray('└' + '─'.repeat(65)),
        '',
      ].join('\n');

      if (statusCode >= 400) {
        this.logger.error(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
