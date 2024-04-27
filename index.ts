import express, { Request, Response } from 'express';

import cors from 'cors';
import { config } from 'dotenv';

import { handleSuccess } from './utils/response.utils';
import { requestMiddleware } from './middleware/logger';

// Establish Connection
import mongoose from './setups/mongo';
import { registerRoutes } from './routes';
mongoose.connection;

config();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.use(express.static('public'));

app.use(requestMiddleware);

registerRoutes(app);

app.use(requestMiddleware);

app.get('/', (req: Request, res: Response) => {
  handleSuccess(res, {
    message: 'Express App: Sample App',
  });
});

app.listen(process.env.PORT, () =>
  console.log(`Server Up:${process.env.PORT}`)
);
