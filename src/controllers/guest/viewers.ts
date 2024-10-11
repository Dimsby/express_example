import express from "express";
import * as helper from '../../helper';
import {logger} from "../../services/logger";
import joi from "joi";
import StreamViewers from "../../model/StreamViewers";
import mongoose from "mongoose";
import { joiIdSchema } from "../../utils/joiHelper";
import UserGuests from "../../model/UserGuests";

const sortableFields = ['_id'];

export const schema = {
    'GET': () => {
        return joi.object().keys({
            viewersOf: joiIdSchema,
            _id: joiIdSchema,

            order: joi.string().valid(
              ...sortableFields, ...sortableFields.map((a) => `-${a}`),
            ),
            skip: joi.number().integer().min(0),
            limit: joi.number().integer().min(0).max(100),
            count: joi.boolean(),
        })
    }
}

export const getAction = async(req: express.Request, res: express.Response,next:any)=>{
    if (helper.validateRequest(schema['GET'](), req.query, res)) return;

    const { skip, limit, order, viewersOf, _id } = req.query;

    try {
        const viewers = await StreamViewers.getViewerIds(new mongoose.Types.ObjectId(viewersOf as string), true)

        const filter:any = {
            ..._id && ({_id})
        };
        filter['_id'] = { $in: viewers }

        const userQuery = UserGuests.find(filter).select("country ipAddress")

        const total = await UserGuests.count(userQuery)

        const guestUsers = await userQuery
            .sort(order as string || '_id')
            .limit(limit ? +limit : 100)
            .skip(skip ? +skip : 0)

        if (!guestUsers) return helper.generateSucc(res, 'No guest viewers', []);

        helper.generateSucc(res, 'Guest viewers', { items: guestUsers, total });
    } catch (error) {
        logger.error(error)
        return helper.generateErr(res, error.message, 400);
    }
}