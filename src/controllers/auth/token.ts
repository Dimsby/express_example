import express from "express";
import {logger} from "../../services/logger";
import * as helper from "../../helper";
import User, {ACCOUNT_API} from "../../model/Users";
import joi from "joi";
import {getHash} from "../../utils/passwordHelper";
import jwt from "jsonwebtoken";
import {config} from "../../config";
import crypto from "crypto";
import { generateSessionToken } from "../../utils/session";

export const schema = {
    'POST': () => joi.object().keys({
        email: joi.string().required(),
        password: joi.string().required()
    })
}

/**
 * Get token for externals api use
 * @param req
 * @param res
 */
export const postAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['POST'](), req.body, res)) return;

    const {email, password} = req.body

    try {
        const pwdHash = getHash(password);
        const user: any = await User.findOne({email, accountType: ACCOUNT_API})
            .select('_id password token')
            .lean()

        if (!user) {
            logger.error('discord wrong login data', {email, password} )
            return helper.generateErr(res, "Not found", 404);
        }

        if (user.password != pwdHash)
            return helper.generateErr(res, "The password is not valid", 401);

        // do not regenerate token if old one is valid
        if (user.token) {
            try {
                if (jwt.verify(user.token, config.auth.jwt_secret))
                    return helper.generateSucc(res, 'token', user.token);
            } catch (ignore) {} // saved token expired or wrong in other ways, generate it again
        }

        const {token, sessionId} = generateSessionToken(config.auth.jwt_api_expire_in)
        
        User.updateOne({_id: user._id},{
            token: token,
            sessionId: sessionId,
            nonce: crypto.randomBytes(30).toString('hex'),
            onlineStatus: true,
            onlineLast: new Date(),
        }).then()

        return helper.generateSucc(res, 'token', token);
    } catch (e) {
        logger.error('GET TOKEN', e, req.body)
        return helper.generateErr(res, e.message, 400);
    }
}