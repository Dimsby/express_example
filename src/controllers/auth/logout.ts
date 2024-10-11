import express from "express";
import User from "../../model/Users";
import * as helper from "../../helper";
import {emitEvent} from "../../services/socket";

export const schema = () => {
    const joi = require('joi');
    return joi.object().keys({
        // not used yet.
    });
}

/**
 * Controller
 */

export const getAction = async (req: express.Request, res: express.Response) => {
    try {
        const {info}: any = req.user
        await User.logout(info._id, info.accountType)
        await User.findOneAndUpdate({_id: info._id}, {$unset: {token: 1}})

        emitEvent(`user_${info._id}`, {msg: "logout"})

        helper.generateSucc(res, 'Logout Successfully Done');
    } catch (error: any) {
        helper.generateErr(res, error.message);
    }
}
