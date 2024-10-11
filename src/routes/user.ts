import {refreshToken} from '../controllers/userc';
import {auth, authAdmin, authAnon, authManager, authNonWhitelisted} from '../middlewares/auth';
import express from 'express';
import * as user from '../controllers/user';
import * as notifications from '../controllers/notifications';
import * as dashboard from '../controllers/dashboard';

const userRouter = express.Router();

// list
userRouter.get('/', authAnon, user.main.getAction);

// affiliate report
userRouter.get('/affiliate', auth, user.affiliate.getAction);
userRouter.get('/affiliate/transactions', auth, user.affiliate.getTransactionsAction);

userRouter.get('/top', authAnon, dashboard.top.getAction);

// social file
userRouter.get('/social', authAdmin, user.social.getAction);

// user images
userRouter.post('/images', auth, user.images.postAction)
userRouter.post('/images/:type', auth, user.images.postAction)
userRouter.get('/:id/images', authAnon, user.images.getAction)
userRouter.get('/:id/images/:type', authAnon, user.images.getAction)
userRouter.get('/:id/images/:type/:subtype', authAnon, user.images.getAction)
userRouter.delete('/images', auth, user.images.deleteAction)
userRouter.delete('/images/:type', auth, user.images.deleteAction)

userRouter.get('/confirm-email/:token', user.verify_email.getAction);
userRouter.get('/refresh-token', auth, refreshToken)

// crypto wallet
userRouter.put('/wallet', authNonWhitelisted, user.wallet.putAction);
userRouter.delete('/wallet',auth, user.wallet.deleteAction);

// withdraw settings
userRouter.get('/:id/withdraw', authManager, user.withdraw.getAction);

// read, update, delete
userRouter.get('/:id', authAnon, user.item.getAction);
userRouter.put('/:id', auth, user.item.putAction)
userRouter.delete('/:id',auth, user.item.deleteAction);

// user blacklist
userRouter.get('/:id/block', auth, user.block.getAction)
userRouter.put('/block/:id', auth, user.block.putAction)
userRouter.put('/unblock/:id', auth, user.unblock.putAction)
userRouter.delete('/:id/unblock', auth, user.unblock.deleteAction)

// notifications
userRouter.get('/:id/notifications', auth, notifications.main.getAction)
userRouter.post('/:id/notifications', auth, notifications.main.postAction)
userRouter.put('/:id/notifications/:notificationId', auth, notifications.main.putAction)
userRouter.put('/:id/notifications', auth, notifications.main.putAction)
userRouter.delete('/:id/notifications/:notificationId', auth, notifications.main.deleteAction)
userRouter.delete('/:id/notifications', auth, notifications.main.deleteAction)

// default tip menu for profile
userRouter.get('/:id/tips', authAnon, user.tips.getAction)

//Feedback Mail
userRouter.post('/feedback', auth, user.feedback.postAction)

// Chat cleanup
userRouter.post('/chat/cleanup', auth, user.chat.postAction)

// download IDs 
userRouter.get('/:id/file/:fileId', auth, user.file.getAction)
// activate user
userRouter.put('/:id/activate', auth, user.verifyId.putAction)

// upload docs from admin
userRouter.post('/:id/docs', auth, user.docs.postAction)
userRouter.delete('/:id/docs/:docId', authManager, user.docs.deleteAction)

// creates a new random streamKey, updates lastStreamKey, returns streamKey to user
userRouter.get('/:id/streamKey', auth, user.streamKey.getAction)

export { userRouter }
