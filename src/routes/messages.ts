import express from 'express';
import * as messages from '../controllers/messages';
import {auth, authAnon} from "../middlewares/auth";

const messagesRouter = express.Router();

messagesRouter.get('/:id/attach', authAnon, messages.attach.getAction);
messagesRouter.delete('/:id/attach', auth, messages.attach.deleteAction);
messagesRouter.post('/:type/:id/attach', auth, messages.attach.postAction);

messagesRouter.post('/:type/:id', authAnon, messages.item.postAction);
messagesRouter.put('/:id', auth, messages.item.putAction);
messagesRouter.delete('/:id', auth, messages.item.deleteAction);

messagesRouter.post('/:id', auth, messages.main.postAction);
messagesRouter.get('/:type/:id', authAnon, messages.main.getAction);

messagesRouter.get('/group', auth, messages.group.getAction);
messagesRouter.delete('/group/:otherUserId', auth, messages.group.deleteAction);

messagesRouter.get('/:id', authAnon, messages.item.getAction);

export {messagesRouter}