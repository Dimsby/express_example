import express from "express";
import User from "../../model/Users";
import * as helper from '../../helper';


export const schema = () => {
    var joi = require('joi');
    return joi.object().keys({
        address: joi.string().pattern(new RegExp('^0x[a-fA-F0-9]{40}$')).required()
    });
}

/**
 * Controller
 */
export const getAction = async(req: express.Request, res: express.Response)=>{
    if (helper.validateRequest(schema(), req.query, res)) return;

    const {address}=req.query

    const user:any = await User.findOne({ address })

    if (!user) {
        return helper.generateErr(res,  "This wallet is not registered", 324);
    } else {
        helper.generateSucc(res, 'See data', {nonce: user.nonce});
    }

}
