import express from "express";
import * as helper from "../../helper";

import Messages, {EMessageType, IMessage} from "../../model/Messages";
import joi from "joi";
import {joiIdSchema} from "../../utils/joiHelper";
import BlockUser from "../../model/Block";
import UserChatCleanup from "../../model/UserChatCleanup";
import Streams from "../../model/Streams";
import StreamerSettings, {DEFAULT_PRIVATE_MESSAGES_COST} from "../../model/StreamerSettings";
import User, {ACCOUNT_STREAMER} from "../../model/Users";

export const schema = {
    'GET': () => {
        return joi.object().keys({
            type: joi.string().valid(...Object.values(EMessageType)).required(),
            sort: joi.string().valid('asc', 'desc'),
            reverse: joi.boolean(),
            id: joiIdSchema.required(),
            skip: joi.number().integer().min(0),
            limit: joi.number().integer().min(0).max(100)
        });
    },
    'POST_PARAMS': () => {
        return joi.object().keys({
            id: joiIdSchema.required(),
        });
    },
    'POST_BODY': () => {
        return joi.object().keys({
            limit: joi.number().integer().min(0).max(30)
        });
    }
}

/**
 * GET /messages/{stream|show|user}/{streamer_id|user_id}
 *
 * @param req
 * @param res
 */
export const getAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['GET'](), {...req.params, ...req.query}, res)) return;

    const {info}: any = req.user || {};
    const messageType: EMessageType = EMessageType[req.params.type]
    const my: boolean = info?._id.equals(req.params.id)

    try {
        // if message author blocked me
        if (info && messageType == EMessageType.user && await BlockUser.isBlockedBy(req.params.id, info._id))
            return helper.generateErr(res, "Blocked", 503);

        const {sort, skip, limit} = req.query;

        const filter: any = {type: messageType}
        // recipient is user
        if (info && messageType == EMessageType.user) {
            filter['$or'] = [
                {recipientId: info._id, userId: req.params.id},
                {recipientId: req.params.id, userId: info._id}
            ]
        } else {
            // recipient is stream (private or public)
            //const stream = await Streams.findOne({userId: req.params.id}, '_id').lean()

            filter.recipientId = req.params.id
            filter.operation = {$nin: ['user', 'service']} /*my
                ? (stream ? {$ne: 'service'} : {$nin: ['user', 'service']})
                : {$nin: ['user', 'service']}*/
            // do not show messages before the user's cleanup
            /*

            if (stream) {
                const cleanup: any = await UserChatCleanup
                    .findOne({streamerId: stream.userId, userId: info._id}, 'date')
                    .lean()
                if (cleanup) filter.createdAt = {$gte: cleanup.date}
            }*/
        }

        let messages: Array<IMessage> = await Messages.find(filter)
            .populate('user', 'name profileImg accountType')
            .sort(sort == 'asc' ? 'createdAt' : '-createdAt')
            .limit(limit ? +limit : 50)
            .skip(skip ? +skip : 0)

        // fill data for messages
        if (messages.length && info) {
            const blockedIds = await BlockUser.getBlockedIds(info._id) // get blocked by me
            messages = messages.filter(message => message.isGuest || !!message.user)
            messages.forEach(message => {
                    if (message.user) {
                        // flag users that I block
                        if (blockedIds) message.user.fillIsBlocked(blockedIds)

                        // append hidden part of message for message author or stream owner
                        if (message.hiddenText) {
                            if (info._id.equals(message.userId) || my)
                                message.text += ` ${message.hiddenText}`
                            message.hiddenText = undefined
                        }

                    }
                })
        }

        const result: any = {messages: messages}

        if (info && messageType == EMessageType.user) {
            const settings: any = await StreamerSettings.findOne({userId: req.params.id}).lean()
            const streamer: any = await User.findById(req.params.id, 'accountType').lean()
            // settings === null for viewers
            if (streamer.accountType == ACCOUNT_STREAMER) {
                result.privateMinBalance = settings?.privateMinBalance ?? DEFAULT_PRIVATE_MESSAGES_COST ;
                result.isPmUnlocked = await info.fillIsPmUnlocked(null, {
                    _id: req.params.id,
                    privateMinBalance: settings?.privateMinBalance ?? DEFAULT_PRIVATE_MESSAGES_COST
                })
            }
        }

        return helper.generateSucc(res, 'See objects', result);
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }
}

/**
 * POST /messages/:id
 * Set read status
 *
 * @param req
 * @param res
 */
export const postAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['POST_PARAMS'](), req.params, res)) return;
    if (helper.validateRequest(schema['POST_BODY'](), req.body, res)) return;

    const {info}: any = req.user;

    try {
        await Messages.setRead(req.params.id, info._id, req.body.limit)
        return helper.generateSucc(res, 'Updated');
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }
}
