import express from "express";
import joi from "joi";
import * as helper from "../../helper";
import Setting from "../../model/Settings";
import {logger} from "../../services/logger";

export const schema = {
    'GET': () => {
        return joi.object().keys({
            skip: joi.number().integer().min(0),
            limit: joi.number().integer().min(0).max(100)
        });
    }
}

/**
 * Get list of all settings, route should be set to admin only
 * GET /settings
 */
export const getAction = async (req: express.Request, res: express.Response) => {
    const {skip, limit} = req.query;

    try {
        return helper.generateSucc(res, 'See Objects',
            await Setting.find({}, '-__v -_id')
                .sort('field')
                .limit(limit ? +limit : 100)
                .skip(skip ? +skip : 0)
        );
    } catch (error) {
        logger.error(error)
        return helper.generateErr(res, 'Failed', 400);
    }
}