import express from "express";
import * as helper from '../../helper';
import NotificationSetting from "../../model/NotificationSettings";
import {logger} from "../../services/logger";

const joi = require('joi');
export const schema = {
    'POST': () => {
        return joi.object().keys({
            starOnlineAlert: joi.boolean().required(),
            messageAlert: joi.boolean().required(),
            importantEmailAlert: joi.boolean().required(),
        });
    }
}

/**
 * Controller
 */
export const postAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['POST'](), req.body, res)) return;

    const {info}: any = req.user;

    const data: any = req.body;
    data.userId = info._id

    try {
        return helper.generateSucc(res, `See object`, await NotificationSetting.findOneAndUpdate({userId: info._id}, data, {upsert: true}));
    } catch (error) {
        logger.error(error)
        return helper.generateErr(res, error.message, 400);
    }
}
