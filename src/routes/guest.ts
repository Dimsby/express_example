import {authManager} from '../middlewares/auth';
import express from 'express';
import * as guest from '../controllers/guest';

const guestRouter = express.Router();

guestRouter.get('/viewersOf', authManager, guest.viewers.getAction);

export { guestRouter }
