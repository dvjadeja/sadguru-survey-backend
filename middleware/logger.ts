import { Request, Response } from 'express';

import { randomUUID } from 'crypto';

export const requestMiddleware = (req: Request, res: Response, next: any) => {
  const responseId = randomUUID();
  res.locals.responseId = responseId;

  next();
};
