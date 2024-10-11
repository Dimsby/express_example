import joi from "joi";
import {joiIdSchema, joiNullableIdSchema} from "../../utils/joiHelper";
import express from "express";
import * as helper from "../../helper";
import {AccessControl} from "accesscontrol";
import Notifications, {ENotificationIcon} from "../../model/Notifications";
import {logger} from "../../services/logger";

const bodySchema = {
    title: joi.string().min(3).max(100).alter({
        post: (schema) => schema.required()
    }),
    text: joi.string().min(3).max(500).alter({
        post: (schema) => schema.required()
    }),
    icon: joi.string().valid(...Object.values(ENotificationIcon))
}
const limitSchema = {limit: joi.number().integer().min(0).max(100)}
export const schema = {
    'GET': () => {
        return joi.object().keys({
            id: joiNullableIdSchema.required(),
            skip: joi.number().integer().min(0),
            ...limitSchema
        });
    },
    'POST_PARAMS': () => {
        return joi.object().keys({
            id: joiIdSchema.required(),
        });
    },
    'POST_BODY': () => {
        return joi.object().keys(bodySchema);
    },
    'PUT_PARAMS': () => {
        return joi.object().keys({
            id: joiNullableIdSchema.required(),
            notificationId: joiIdSchema
        });
    },
    'PUT_BODY': () => {
        return joi.object().keys({
            ...bodySchema,
            ...limitSchema,
            isRead: joi.boolean()
        });
    },
    'DELETE': () => {
        return joi.object().keys({
            id: joiNullableIdSchema.required(),
            notificationId: joiIdSchema,
        });
    }
}

const ac = new AccessControl({
    admin: {
        notification: {
            'read:any': ['*'],
            'create:any': ['*'],
            'update:any': ['*']
        }
    },
    streamer: {
        notification: {
            'read:own': ['*'],
            'update:own': ['isRead'],
            'delete:own': ['*']
        }
    },
    viewer: {
        notification: {
            'read:own': ['*'],
            'update:own': ['isRead'],
            'delete:own': ['*']
        }
    }
});
ac.grant('affiliate').extend('viewer')

/**
 * GET /users/{0|id}/notifications - get list of notifications for specified user
 *
 * @param req
 * @param res
 */
export const getAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['GET'](), {...req.params, ...req.query}, res)) return;

    const {info}: any = req.user;
    const {skip, limit} = req.query;

    try {
        // check permissions for user id
        const filter = {
            userId: ac.can(info.accountType).readAny('notification').granted
                ? (req.params.id === '0' ? info._id : req.params.id)
                : info._id
        }

        let notifications = await Notifications.find(filter)
            .sort('-createdAt')
            .limit(limit ? +limit : 50)
            .skip(skip ? +skip : 0)

        return helper.generateSucc(res, 'See objects', notifications);
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }
}

/**
 * POST /users/{id}/notifications - send notification to the specified user. Admin only
 *
 * @param req
 * @param res
 */
export const postAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['POST_PARAMS'](), req.params, res)) return;
    if (helper.validateRequest(schema['POST_BODY'](), req.body, res)) return;

    const {info}: any = req.user;
    if (!ac.can(info.accountType).createAny('notification').granted)
        return helper.generateErr(res, 'Forbidden', 403);

    try {
        return helper.generateSucc(res, 'Created', await Notifications.send(req.params.id, {
            ...req.body,
            senderId: info._id
        }));
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }
}

/**
 * PUT /users/{0|id}/notifications/{notificationId}- mark notification read or modify it's text
 * PUT /users/{0|id}/notifications/ mark last notifications as read
 *
 * @param req
 * @param res
 */
export const putAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['PUT_PARAMS'](), req.params, res)) return;
    if (helper.validateRequest(schema['PUT_BODY'](), req.body, res)) return;

    const {info}: any = req.user;

    if (!ac.can(info.accountType).updateOwn('notification').granted)
        return helper.generateErr(res, 'Forbidden', 403);

    // user id from params available for admin only
    const userId = ac.can(info.accountType).updateAny('notification').granted
        ? (req.params.id === '0' ? info._id : req.params.id)
        : info._id

    const notificationId = req.params.notificationId

    // filter data available for update
    let data = {}
    if (notificationId)
        data = ac.can(info.accountType).updateOwn('notification').filter(req.body)

    try {
        // update single notification if notificationId is there or if not set read status to multiple notifications
        const result = notificationId
            ? await Notifications.findOneAndUpdate({_id: notificationId, userId: userId}, data, {new: true})
            : await Notifications.setRead(userId, req.body.limit)
        return helper.generateSucc(res, 'Updated', result);
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }
}

/**
 * DELETE /users/0/notifications/{notificationId} - delete notification by its id
 * DELETE /users/0/notifications - delete all notifications for the user
 *
 * @param req
 * @param res
 */
 export const deleteAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['DELETE'](), req.params, res)) return;

    const {info}: any = req.user;

    if (!ac.can(info.accountType).deleteOwn('notification').granted)
        return helper.generateErr(res, 'Forbidden', 403);

    const notificationId = req.params.notificationId

    try {
        if(notificationId) {
            const deleted = await Notifications.deleteOne({_id: notificationId});
            return helper.generateSucc(res, `Deleted one`, deleted);
        } else {
            const deleted = await Notifications.deleteMany({userId: info._id});
            return helper.generateSucc(res, `Deleted all`, deleted);
        }
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }
}