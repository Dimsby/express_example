import express from "express";
import * as helper from '../../helper';
import Subscribe, {ISubscribe} from "../../model/Subscribe";
import {fillFileFields} from "../../services/upload";
import {logger} from "../../services/logger";

const joi = require('joi');

export const schema = {
    'GET': () => {
        return joi.object().keys({
            skip: joi.number().integer().min(0),
            limit: joi.number().integer().min(0).max(100),
        });
    }
}

/**
 * Get list of subscribers
 * GET /subscribe
 */
export const getAction = async (req: express.Request, res: express.Response) => {
    const {info}: any = req.user;
    const {skip, limit} = req.query;

    try {
        const subs: Array<ISubscribe> = await Subscribe.find({subscribedUser: info._id})
            .select('-_id user')
            .populate('user', 'name profileImg')
            .limit(limit ? +limit : 50)
            .skip(skip ? +skip : 0)

        // return populated user field only
        const items = subs
            .filter(sub => !!sub.user)
            .map(sub => {
                if (sub.user && sub.user['profileImg']) fillFileFields(sub.user, 'profileImg', 'users')
                return sub.user
            })

        helper.generateSucc(res, 'See objects', items);
    } catch (error) {
        logger.error(error);
        return helper.generateErr(res, error.message, 400);
    }
}
