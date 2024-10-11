import express from "express";
import * as helper from "../../helper";
import {Storage} from "../../services/storage";
import {config} from "../../config";
import joi from "joi";
import {logger} from "../../services/logger";

export const schema = {
    'GET': () => {
        return joi.object().keys({
            key: joi.string().required().min(5).max(100),
        });
    },
}

export const getAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['GET'](), req.query, res)) return;

    try {
        const imageObj: any = await Storage.get().getObjectFromBucket(`banners/${req.query.key}` as string, config.recordings.storage.opts.staticBucket)
        imageObj.createReadStream()
            .on('error', () => {
                return helper.generateErr(res, 'Not Found', 404);
            })
            .pipe(res)
    } catch (error) {
        logger.error(error)
        return helper.generateErr(res, error.message, 400);
    }
}