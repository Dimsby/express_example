import express from "express";
import joi from "joi";
import * as helper from "../../helper";
import {logger} from "../../services/logger";
import Setting from "../../model/Settings";

const fieldSchema = {
    field: joi.string().alphanum().max(30).min(1).required()
}

export const schema = {
    'GET': () => joi.object().keys(fieldSchema),
    'PUT_PARAMS': () => joi.object().keys(fieldSchema),
    'PUT_BODY': () => joi.object().keys({
        settingValue: joi.string()
    })
}

/**
 * Get value of given setting
 * GET /settings/:field
 */
export const getAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['GET'](), req.params, res)) return;

    try {
        return helper.generateSucc(res, 'Setting Value', await Setting.getValue(req.params.field));
    } catch (error) {
        logger.error(error)
        return helper.generateErr(res, 'Failed', 400);
    }
}

/**
 * Set value of given setting, admin only
 * PUT /settings/:field
 */
export const putAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['PUT_PARAMS'](), req.params, res)) return;
    if (helper.validateRequest(schema['PUT_BODY'](), req.body, res)) return;

    try {
        return helper.generateSucc(res, 'Updated', await Setting.setValue(req.params.field, req.body.settingValue));
    } catch (error) {
        logger.error(error)
        return helper.generateErr(res, 'Failed', 400);
    }
}