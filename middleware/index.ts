import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth.utils';
import { Users } from '../models';
import { handleErrors } from '../utils/response.utils';

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const auth = req.headers.authorization;

  if (auth) {
    const token = auth.slice(7, auth.length); // Bearer TOKEN

    try {
      const decode = await verifyToken(token);

      if (!decode) throw new Error('Unauthorized access');

      const user = await Users.findOne({ _id: decode._id || '' });

      if (!user)
        throw new Error('You are unauthorized to perform this action.');

      res.locals.user = {
        userId: decode._id,
        ...user.toObject(),
        role: decode.role,
      };

      next();
    } catch (error) {
      handleErrors(req, res, {
        status: 401,
        error,
      });
    }
  } else {
    handleErrors(req, res, {
      status: 401,
      error: 'Missing Authorization token',
    });
  }
};
