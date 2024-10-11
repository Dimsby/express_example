import express from "express";
import mongoose from "mongoose";

import * as helper from "../../helper";
import {joiIdSchema} from "../../utils/joiHelper";
import Messages, {EMessageType, IMessage} from "../../model/Messages";
import {sendMessageEvent} from "../../services/socketEvents";
import {ACCOUNT_STREAMER} from "../../model/Users";
import Streams from "../../model/Streams";
import Subscribe from "../../model/Subscribe";
import Notifications, {ENotificationIcon} from "../../model/Notifications";
import {logger} from "../../services/logger";
import StreamerSettings from "../../model/StreamerSettings";

const joi = require("joi");
const joiText = joi.string().max(1000).min(1);

export const schema = {
    GET: () => {
        return joi.object().keys({
            id: joiIdSchema.required(),
        });
    },
    POST_PARAMS: () => {
        return joi.object().keys({
            type: joi
                .string()
                .valid(...Object.values(EMessageType))
                .required(),
            id: joiIdSchema.required(),
        });
    },
    POST_BODY: () => {
        return joi.object().keys({
            // body
            text: joiText.required(),
            operation: joi.string(),
        });
    },
    PUT_PARAMS: () => {
        return joi.object().keys({
            id: joiIdSchema.required(),
        });
    },
    PUT_BODY: () => {
        return joi.object().keys({
            text: joiText,
            isRead: joi.boolean(),
        });
    },
    DELETE: () => {
        return joi.object().keys({
            id: joiIdSchema.required(),
        });
    },
};

/**
 * GET /messages/{id}
 * get single message
 *
 * @param req
 * @param res
 */
export const getAction = async (
    req: express.Request,
    res: express.Response
) => {
    if (helper.validateRequest(schema["GET"](), req.params, res)) return;

    const {info}: any = req.user || {};

    try {
        const filter = info
            ? {_id: req.params.id}
            : {_id: req.params.id, type: EMessageType.stream}; // for anon allow stream messages only
        const message: IMessage = await Messages.findOne(filter).populate(
            "user",
            "name profileImg"
        )

        if (!message) return helper.generateErr(res, "Not Found", 404);

        // stream messages: add hidden message for author or stream owner
        if (message.type === EMessageType.stream && message.hiddenText) {
            if (info._id.equals(message.userId) || info._id.equals(message.recipientId))
                message.text += ` ${message.hiddenText}`
            message.hiddenText = undefined
        }

        return helper.generateSucc(res, "See object", message);
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }
};

/**
 *
 * send message to stream, private stream, user private
 * POST /messages/{stream|show|user}/{streamer_id|user_id}
 *
 * @param req
 * @param res
 */
export const postAction = async (
    req: express.Request,
    res: express.Response
) => {
    if (helper.validateRequest(schema["POST_PARAMS"](), req.params, res)) return;
    if (helper.validateRequest(schema["POST_BODY"](), req.body, res)) return;

    // get active user
    const info: any = req.user?.info;

    try {
        const operation =
            info?.accountType == ACCOUNT_STREAMER ? req.body?.operation : false;

        // handling Private Messaging
        if (req.params.type === "user") {
            const stream: any = await Streams.findOne({
                userId: new mongoose.Types.ObjectId(req.params.id),
            });

            if (stream) {
                if (stream.messagesAllowed) {
                    const settings = await StreamerSettings.findOne({
                        userId: req.params.id,
                    });

                    const privacyMessageMe = settings?.privacyMessageMe;

                    if (privacyMessageMe === "subs") {
                        const subscribe: any = await Subscribe.findOne({
                            user: req.params.id,
                            subscribedUser: info?._id,
                        });

                        if (!subscribe) {
                            Notifications.send(info?._id, {
                                icon: ENotificationIcon.alert,
                                title: "Message was not sent.",
                                text: "This facility is for subscribers only.",
                                type: "recording",
                            }).catch((err: any) => {
                                logger.error("Record notification error:", err);
                            });

                            return helper.generateErr(res, "Chat is disabled.", 403);
                        }
                    }

                    if (privacyMessageMe === "nobody") {
                        Notifications.send(info._id, {
                            icon: ENotificationIcon.alert,
                            title: "Message was not sent.",
                            text: "This facility is disabled by the model.",
                            type: "recording",
                        }).catch((err: any) => {
                            logger.error("Record notification error:", err);
                        });

                        return helper.generateErr(res, "Chat is disabled.", 403);
                    }
                } else {
                    Notifications.send(info?._id, {
                        icon: ENotificationIcon.alert,
                        title: "Message was not sent.",
                        text: "This facility is disabled by the model.",
                        type: "recording",
                    }).catch((err: any) => {
                        logger.error("Record notification error:", err);
                    });

                    return helper.generateErr(res, "Chat is disabled.", 403);
                }
            }
        } else {
            // handling stream and show chat
            if (info?._id.toString() !== req.params.id) {
                const stream: any = await Streams.findOne({
                    userId: new mongoose.Types.ObjectId(req.params.id),
                });

                if (stream?.chatAllowedFor === "nobody") {
                    Notifications.send(info?._id, {
                        icon: ENotificationIcon.alert,
                        title: "Message was not sent.",
                        text: "This is readonly chat.",
                        type: "recording",
                    }).catch((err: any) => {
                        logger.error("Record notification error:", err);
                    });

                    return helper.generateErr(res, "Chat is disabled.", 403);
                }

                if (stream?.chatAllowedFor === "subs") {
                    const subscribe: any = await Subscribe.findOne({
                        user: req.params.id,
                        subscribedUser: info?._id,
                    });

                    if (!subscribe) {
                        Notifications.send(info?._id, {
                            icon: ENotificationIcon.alert,
                            title: "Chatting is restricted by model.",
                            text: "Please subscribe to chat.",
                            type: "recording",
                        }).catch((err: any) => {
                            logger.error("Record notification error:", err);
                        });

                        return helper.generateErr(res, "Please subscribe to chat.", 403);
                    }
                }
            }
        }
        const message: IMessage = await Messages.createMessage(
            {
                type: req.params.type,
                isGuest: info === undefined,
                userId: info?._id,
                recipientId: new mongoose.Types.ObjectId(req.params.id),
                text: req.body.text,
                ...(operation && {operation}),
            },
            {
                notify: {operation: "post"},
                accountType: info?.accountType ?? 'Guest',
                senderName: info?.name ?? "Guest"
            }
        );
        await message.populate("user", "name profileImg");

        return helper.generateSucc(res, "Created", message);
    } catch (error) {
        logger.error('Message send failed', error, req.params)
        return helper.generateErr(res, error.message, 400);
    }
};

/**
 * PUT /messages/{message_id}
 *
 * @param req
 * @param res
 */
export const putAction = async (
    req: express.Request,
    res: express.Response
) => {
    if (helper.validateRequest(schema["PUT_PARAMS"](), req.params, res)) return;
    if (helper.validateRequest(schema["PUT_BODY"](), req.body, res)) return;

    // get active user
    const {info}: any = req.user;

    try {
        const message: IMessage = await Messages.findOneAndUpdate(
            {
                _id: req.params.id,
                userId: info._id,
            },
            req.body,
            {new: true}
        );

        if (!message) return helper.generateErr(res, "Message Not Found", 404);

        sendMessageEvent(message, {operation: "put"});

        return helper.generateSucc(res, "Updated");
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }
};

/**
 * DELETE /messages/{message_id}
 *
 * @param req
 * @param res
 */
export const deleteAction = async (
    req: express.Request,
    res: express.Response
) => {
    if (
        helper.validateRequest(
            schema["DELETE"](),
            {...req.params, ...req.body},
            res
        )
    )
        return;

    // get active user
    const {info}: any = req.user;

    try {
        // Filter parameter will depend on the users role.
        // If the user is model, Model can delete all it's messages from the chat.
        // The user can delete, It's own message.
        // The Guest cannot delete it's own message.
        
        const message: IMessage = await Messages.findOneAndDelete({
            _id: req.params.id,
            $or: [{userId: info._id}, {recipientId: info._id}]
        });
        if (!message) return helper.generateErr(res, "Message Not Found", 404);

        sendMessageEvent(message, {operation: "delete"});

        return helper.generateSucc(res, "Deleted");
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }
};
