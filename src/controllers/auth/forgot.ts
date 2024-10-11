import express from "express";
import joi from "joi";
import * as helper from "../../helper";
import resetPassword from "../../services/auth/resetPassword";
import {config} from "../../config";
import User from "../../model/Users";
import {getHash} from "../../utils/passwordHelper";
import {SBError} from "../../services/error/sberror";
import {logger} from "../../services/logger";

const errWrongToken: string = 'Reset code expired or wrong'

export const schema = {
    'POST': () => {
        return joi.object().keys({
            email: joi.string().email().required()
        })
    },
    'GET': () => {
        return joi.object().keys({
            token: joi.string().min(3).max(300).required()
        })
    },
    'PUT': () => {
        return joi.object().keys({
            token: joi.string().min(3).max(300).required(),
            password: joi.string().min(6).max(40).required().label('Password'),
            password_confirmation: joi.any().equal(joi.ref('password'))
                .label('Confirm password')
                .messages({ 'any.only': '{{#label}} does not match' })
                .when('password', {is: joi.exist(), then: joi.required()}),
        })
    }
}

/**
 * Send email with link for password change to given email address
 * POST auth/forgot
 */
export const postAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['POST'](), req.body, res)) return;
    const email: string = req.body.email

    try {
        // return link if api testing
        const link = await resetPassword.sendEmail(email)
        return helper.generateSucc(res, 'Email Send',
            config.app.api_testing ? link : null);
    } catch (error) {
        if (error! instanceof SBError) logger.error(error)
        return helper.generateErr(res, error.message, error.responseCode || 400);
    }

}

/**
 * Check that token is valid
 * GET auth/forgot/:token
 */
export const getAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['GET'](), req.params, res)) return;

    try {
        return await resetPassword.checkLink(req.params.token)
            ? helper.generateSucc(res, 'Success')
            : helper.generateErr(res, errWrongToken, 400);
    } catch (error) {
        if (error! instanceof SBError) logger.error(error)
        return helper.generateErr(res, errWrongToken, 400);
    }
}

/**
 * Reset password
 * PUT auth/forgot/
 */
export const putAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['PUT'](), req.body, res)) return;

    try {
        const userId: number|boolean = await resetPassword.checkLink(req.body.token)
        if (!userId)
            return helper.generateErr(res, errWrongToken, 400);

        await User.findOneAndUpdate({_id: userId}, {
            password: getHash(req.body.password),
            $unset: {passwordResetAttempts: 1, passwordResetStartedAt: 1}
        })
        return helper.generateSucc(res, 'Updated')
    } catch (error) {
        if (error! instanceof SBError) logger.error(error)
        return helper.generateErr(res, error.message, error.responseCode || 400);
    }
}