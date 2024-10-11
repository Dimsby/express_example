import express from "express";
import * as helper from "../../helper";

import Messages, {EMessageType} from "../../model/Messages";
import joi from "joi";
import BlockUser from "../../model/Block";
import { joiIdSchema } from "../../utils/joiHelper";

export const schema = {
    'GET': () => {
        return joi.object().keys({
            skip: joi.number().integer().min(0),
            limit: joi.number().integer().min(0).max(30)
        });
    },
    'DELETE': () => {
        return joi.object().keys({
            otherUserId: joiIdSchema.required(),
        });
  }
}

/**
 * Messages send to active user grouped by message author
 * GET /messages/group/
 *
 * @param req
 * @param res
 */
export const getAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['GET'](), {...req.params, ...req.query}, res)) return;

    const {info}: any = req.user;
    const {skip, limit}: any = req.query;

    // messages send to active user or by active user
    const filter: any = {
        type: EMessageType.user,
        $or: [
            {recipientId: info._id},
            {userId: info._id}
        ],
    }

    // filter if user is blocked
    const blockedMe = await BlockUser.getIdsWhoBlocked(info._id)
    if(blockedMe) {
        filter['userId'] = {$nin: blockedMe}
        filter['recipientId'] = {$nin: blockedMe}
    }

    try {
        let messages = await Messages.aggregate([
            {$match: filter},
            {$sort: {createdAt: -1}}, // sort by message createdAt for group stage
            {$limit: 300}, // no more than 300 messages for group stage
            {
                $group: {
                    _id: {"$setUnion": [['$userId'], ['$recipientId']]}, // group by union
                    userId: {$first: "$userId"},
                    recipientId: {$first: "$recipientId"},
                    lastMessageId: {$first: "$_id"},
                    createdAt: {$first: "$createdAt"},
                    messages: {$sum: {$cond: [ {$and: [ {$eq: ['$isRead', false]}, {$eq: ['$recipientId', info._id]} ]}, 1, 0]}} // count unread messages
                }
            },
            {   // join last message text
                $lookup: {
                    from: 'messages',
                    localField: 'lastMessageId',
                    foreignField: '_id',
                    as: 'lastMessage',
                    pipeline: [
                        {
                            $project: {
                                text: 1,
                                attachExt: 1
                            }
                        }
                    ]
                }
            },
            {$unwind: '$lastMessage'},
            {$skip: skip ? +skip : 0},
            {$limit: limit ? +limit : 30},
            {$sort: {createdAt: -1}} // sort by createdAt result aggregation
        ])

        messages = messages.map((doc) => {
            // show recipient as user if user is active user
            if (doc.userId.equals(info._id))
                doc.userId = doc.recipientId
            // show attachment
            if (doc.lastMessage.attachExt)
                doc.lastMessage.attach = `/messages/${doc.lastMessageId}/attach`

            delete doc.lastMessageId

            return Messages.hydrate(doc)
        })
        await Messages.populate(messages, {path: "user", select: "name profileImg onlineStatus"});

        const blockedByMe = await BlockUser.getBlockedIds(info._id)
        messages.forEach(message => {
            if (blockedByMe && message['user']) message['user'].fillIsBlocked(blockedByMe)
        })

        return helper.generateSucc(res, 'See objects', messages);
    } catch (error) {
        console.log(error)
        return helper.generateErr(res, error.message, 400);
    }
}

/**
 * Messages send to active user grouped by message author
 * DELETE /messages/group/{otherUserId}
 *
 * @param req
 * @param res
 */
 export const deleteAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['DELETE'](), req.params, res)) return;

    const {info}: any = req.user;

    const myId = info._id.toString();
    const otherUserId = req.params.otherUserId;

    try {
        const result = await Messages.deleteMany({
            $or: [
                {userId: myId, recipientId: otherUserId},
                {userId: otherUserId, recipientId: myId},
            ]
        });

        return helper.generateSucc(res, `Deleted many`, result);
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }
}
