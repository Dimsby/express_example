import express from "express";
import * as helper from '../../helper';
import Subscribe from "../../model/Subscribe";
import {joiIdSchema} from "../../utils/joiHelper";
import Users from "../../model/Users";
import {sendNotificationEmail} from "../../services/mail";
import {logger} from "../../services/logger";
import User from "../../model/Users";
import Notifications from "../../model/Notifications";

const joi = require('joi');

export const schema = {
    'POST_PARAMS': () => {
        return joi.object().keys({
            userId: joiIdSchema.required()
        });
    },
    'DELETE_PARAMS': () => {
        return joi.object().keys({
            userId: joiIdSchema.required()
        });
    }
}

/**
 * subscribe by active user to given user
 * POST /subscribe/:userId
 */
export const postAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['POST_PARAMS'](), req.params, res)) return;

    const {info}: any = req.user;
    const {userId}: any = req.params;

    try {
        const params = {user: userId, subscribedUser: info._id}

        const subData = await Subscribe.find(params);
        if (subData.length !== 0) return helper.generateErr(res, "Already Subscribed", 400);

        await Users.findOneAndUpdate({_id: userId}, {$inc: {subscribersCount: 1}})

        helper.generateSucc(res, `Subscribed`, await Subscribe.create(params).then(() => {

            // notify new subscription
            User.findById(userId, 'email isVerified', {lean: true}).then((user: any) => {
                if (user?.isVerified) {
                    // by site notification
                    Notifications.send(userId, {
                        title: 'Subscription',
                        text: `New subscription from ${info.name}`
                    }).catch((e) => logger.error('Sub Notification failed', e, userId))
                    // by email
                    sendNotificationEmail({
                        to: user.email,
                        subject: 'New Subscription',
                        text: `New subscription from ${info.name}`
                    }).catch((e) => logger.error('Sub Email Notification', e, userId))
                }
            })

        }));
    } catch (error) {
        console.error(error);
        return helper.generateErr(res, error.message, 400);
    }
}

/**
 * Unsubscribe by active user from given user
 * DELETE /subscribe/:userId
 */
export const deleteAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['DELETE_PARAMS'](), req.params, res)) return;

    const {userId}: any = req.params;
    const {info}: any = req.user;

    try {
        // delete sub and decrement subscribersCount if deleted
        if (await Subscribe.findOneAndDelete({subscribedUser: info._id, user: userId}))
            await Users.findOneAndUpdate({_id: userId, subscribersCount: {$gt: 0}}, {$inc: {'subscribersCount': -1}})

        helper.generateSucc(res, 'Deleted');
    } catch (error) {
        console.error(error);
        return helper.generateErr(res, error.message, 400);
    }
}

