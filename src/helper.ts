import {ObjectSchema} from "joi";
import express from "express";
import mongoose from "mongoose";
import {filterDoc} from "./utils/transformHelper";

export const generateErr = (res: express.Response, errors: any, code: number = 400) => {
    return res.status(code).json({
        'status': 'failed',
        'errors': errors
    });
}

export const generateSucc = (res: express.Response, message: string, data: any = null, outputSchema?: Array<string>) => {
    if (data && outputSchema && (data instanceof mongoose.Model) ) {
        data = filterDoc(data.toObject(), outputSchema)

        if (outputSchema.includes("serverDate") && !data["serverDate"]) {
            const serverDate = new Date();
            data["serverDate"] = serverDate
        }
    }

    return res.status(200).json({
        'status': 'success',
        'message': message,
        'data': data
    });
}

export const validateRequest = (schema: ObjectSchema, params: any, res: express.Response) => {
    const result = schema.validate(params, {abortEarly: false});
    if (result.error) {
        var resArray = {};
        result.error.details.forEach((element) => {
            resArray[element.context.label] = element.message
        });
        return generateErr(res, resArray);
    }
    return false;
}

export const escapeRegex = (input: string) => {
    return input.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
