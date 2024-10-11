import {auth, authAnon, authNonWhitelisted} from '../middlewares/auth';
import express from 'express';
import * as authController from '../controllers/auth';
import { refreshTokenAuth } from '../middlewares/refreshTokenAuth';

const authRouter = express.Router();

authRouter.get('/check', authController.check.getAction);
authRouter.post('/register', authController.register.postAction);
authRouter.post('/validate', authController.register.validateAction);
authRouter.post('/login', authController.login.postAction);
authRouter.get('/logout', authNonWhitelisted, authController.logout.getAction);
authRouter.get('/refresh-token', refreshTokenAuth, authController.refreshToken.getAction);

authRouter.post('/forgot', authController.forgot.postAction);
authRouter.get('/forgot/:token', authController.forgot.getAction);
authRouter.put('/forgot', authController.forgot.putAction);

authRouter.post('/verify', auth, authController.verify.postAction)
authRouter.get('/verify/:token', authAnon, authController.verify.getAction)

authRouter.post('/token', authController.token.postAction);

export {authRouter}