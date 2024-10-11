//import { auth } from '../middlewares/auth';
import express from 'express';
import * as test from '../controllers/test';

const testRouter = express.Router();

testRouter.get('/socket', test.socket.getAction);

export {testRouter}