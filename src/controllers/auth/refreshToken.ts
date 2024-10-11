import express from "express";
import * as helper from '../../helper';
import User from "../../model/Users";
import jwt from "jsonwebtoken";
import {config} from '../../config';
import { generateSessionToken, tokenCookieOptions } from "../../utils/session";
const crypto = require('crypto');

export const schema = () => {
    var joi = require('joi');
    // no need here
}

/**
 * Controller
 */
export const getAction = async(req: express.Request, res: express.Response)=>{

    const { info }:any = req.user;

    const payload = {
        id: info.id,
        name: info.name
    };

    const user: any = await User.findById(payload.id);

    const {token, sessionId} = generateSessionToken(config.auth.jwt_expire_in);

    if (!token){
      console.log("Something wrong in the token");
      return helper.generateErr(res,  "Something wrong in the token", 400);
    }

    user.token = token
    user.sessionId = sessionId;
    user.nonce = crypto.randomBytes(30).toString('hex');
    await user.save()
    res.cookie("auth", token, tokenCookieOptions);
    return helper.generateSucc(res, 'Logged in successfully', token);

}
