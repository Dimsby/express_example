import express from "express";
import * as helper from "../../helper";
import { deleteFile, readFile, storageDir, upload } from "../../services/upload";
import Messages, { attachmentDir, attachmentFileTypes, EMessageType, IMessage, IMsg } from "../../model/Messages";
import path from "path";

import joi from "joi";
import { joiIdSchema } from "../../utils/joiHelper";
import * as fs from "fs";
import mongoose from "mongoose";
import { sendMessageEvent } from "../../services/socketEvents";

export const schema = {
    'POST': () => {
        return joi.object().keys({
            id: joiIdSchema.required(),
            type: joi.string().valid(...Object.values(EMessageType)).required(),
        });
    },
    'GET': () => {
        return joi.object().keys({
            id: joiIdSchema.required(),
        });
    },
    'DELETE': () => {
        return joi.object().keys({
            id: joiIdSchema.required(),
        });
    }
}

/**
 * send message with attachment
 * POST /messages/:type/:id/attach
 */
export const postAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['POST'](), req.params, res)) return;

    const { info }: any = req.user;

    return upload(req, res, {
        fileName: 'temp' + info._id,
        uploadDir: attachmentDir,
        resize: { width: 500, height: 500 },
        fileTypes: attachmentFileTypes
    }, async (file) => {
        try {
            const message: IMessage = await Messages.createMessage({
                attachExt: path.extname(file.filename).substring(1),
                type: req.params.type,
                userId: info._id,
                recipientId: new mongoose.Types.ObjectId(req.params.id),
                text: req.body.text || ' ',
            }, {
                notify: { operation: 'post' }
            })
            await message.populate('user', 'name profileImg')

            // rename temp file name to message id name
            fs.rename(file.path, storageDir(attachmentDir + '/' + message._id + path.extname(file.filename)), (err) => {
                if (err) console.log('Rename Failed ' + err)
            })


            return helper.generateSucc(res, 'Send', message);
        } catch (error: any) {
            return helper.generateErr(res, error.message);
        }
    });
}

/**
 * get message attachment
 * GET /messages/:id/attach
 */
export const getAction = async (req: express.Request, res: express.Response) => {
    const { info }: any = req.user || {}; // anon access allowed

    try {
        const message: IMessage = await Messages
            .findOne({ _id: req.params.id }, '_id userId recipientId attachExt attachId')
            .lean()

        // check attach is there
        if (!message || (message && !message.attachExt))
            return helper.generateErr(res, 'Not Found', 404);

        // check recipientId and message author id for private messages
        if (message.type == EMessageType.user && (!info || !message.userId.equals(info._id) || !message.recipientId.equals(info._id)))
            return helper.generateErr(res, 'Forbidden', 403);

        return readFile(res, {
            fileName: message.attachId || message._id,
            fileExt: message.attachExt,
            uploadDir: attachmentDir
        });
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }
}

/**
 * delete message attachment
 * DELETE /messages/:id/attach
 */
export const deleteAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['DELETE'](), req.params, res)) return;

    const { info }: any = req.user;

    try {
        const message: IMessage = await Messages.findOne({
            _id: req.params.id,
            userId: info._id
        })
        if (!message || (message && !message.attachExt))
            return helper.generateErr(res, 'File Not Found', 404);

        deleteFile(message._id + '.' + message.attachExt, attachmentDir)
        await message.update({ $unset: { attach: 1 } })

        sendMessageEvent(message, { operation: 'delete_attach' })

        helper.generateSucc(res, 'Deleted');
    } catch (error) {
        return helper.generateErr(res, error.message, 400);
    }

}