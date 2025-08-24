import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { raw } from 'body-parser';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Chỉ áp dụng middleware này cho route webhook
    if (req.originalUrl.startsWith('/api/v1/webhooks')) {
      raw({ type: 'application/json' })(req, res, next);
    } else {
      // Đối với các route khác, sử dụng JSON parser mặc định (sẽ được NestJS áp dụng sau)
      next();
    }
  }
}
