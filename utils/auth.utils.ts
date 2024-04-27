import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

import { config } from 'dotenv';
config();

export const generateHash = async (value: string) => {
  return await bcrypt.hash(value, 10);
};

export const verifyHash = async (value: string, hash: string) => {
  return await bcrypt.compare(value, hash);
};

export const generateToken = async (payload: any, options?: any) => {
  const JWT_SECRET = process.env.JWT_SECRET;

  return new Promise((resolve, reject) => {
    jwt.sign(payload, `${JWT_SECRET}`, options, (err, token) => {
      if (err) {
        reject(new Error('Error while generating Token'));
      }
      resolve(token);
    });
  });
};

export const verifyToken = async (token: string): Promise<any> => {
  const JWT_SECRET = process.env.JWT_SECRET;

  return new Promise((resolve, reject) => {
    jwt.verify(token, `${JWT_SECRET}`, (err, decoded) => {
      if (err) reject(err);

      resolve(decoded);
    });
  });
};
