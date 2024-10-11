import express from 'express';
import User, {ACCOUNT_ADMIN, ACCOUNT_API, ACCOUNT_MANAGER} from '../model/Users';
import jwt from 'jsonwebtoken';
import {config} from '../config';
import * as helper from '../helper';
import whitelist from "../services/auth/whitelist";
import mongoose from "mongoose";
import UserGuests from "../model/UserGuests";

interface IAuthParams {
    allowAnon: boolean
    allowNonWhitelisted: boolean
    api: boolean
}

const verifyToken = (token, req: express.Request, res: express.Response, next: any, params?: Partial<IAuthParams>) => {
    const allowAnon = params?.allowAnon || false
    const allowNonWhitelisted = params?.allowNonWhitelisted || false

    return jwt.verify(token, config.auth.jwt_secret, async function (err: any, decoded: any) {
        if (err) {
            return allowAnon
                ? next()
                : helper.generateErr(res, params?.api ? 'tokenWrong' : err.message, 401);
        }

        const find: any = await User.findOne({sessionId: decoded.sessionId, token: token})

        if (find) {
            if (!allowNonWhitelisted) {
                const err = await whitelist.check(find)
                if (err !== false)
                    return helper.generateErr(res, {[err]: true}, 400);
            }

            req.user = {info: find};
            next();
        } else if (allowAnon) {
            return next()
        } else {
            return helper.generateErr(res, params?.api ? 'tokenAccountNotFound' : 'User Should Be logged!', 401);
        }
    });
}

// any authenticated user
const auth = (req: express.Request, res: express.Response, next: any) => {
    const token = req.cookies.auth ?? req.headers?.authorization
    verifyToken(token, req, res, next)
}

const authNonWhitelisted = (req: express.Request, res: express.Response, next: any) => {
    const token = req.cookies.auth
    verifyToken(token, req, res, next, {allowNonWhitelisted: true})
}

// any authenticated or guest user
const authAnon = (req: express.Request, res: express.Response, next: any) => {
    const token = req.cookies.auth;

    return verifyToken(token, req, res, () => {
        if (req.user) return next()

        let guestId
        // check if cookies exists
        if (!req.cookies.guestAuth || !mongoose.isValidObjectId(req.cookies.guestAuth)) {
            guestId = new mongoose.Types.ObjectId()
            res.cookie('guestAuth', guestId.toString())
        } else
            guestId = req.cookies.guestAuth

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        UserGuests.getGuest(guestId, ip).then((guest) => {
            req['guest'] = guest;
            return next()
        })

    }, {allowAnon: true})

}

// admin panel auth
const authAdmin = (req: express.Request, res: express.Response, next: any) => {
    const token = req.cookies.auth;
    verifyToken(token, req, res, () => {
        if (req.user['info'].accountType !== ACCOUNT_ADMIN)
            return helper.generateErr(res, 'Forbidden', 403);
        next()
    })
}

// admin and manger
const authManager = (req: express.Request, res: express.Response, next: any) => {
    const token = req.cookies.auth;
    verifyToken(token, req, res, () => {
        if (![ACCOUNT_ADMIN,ACCOUNT_MANAGER].includes(req.user['info'].accountType ))
            return helper.generateErr(res, 'Forbidden', 403);
        next()
    })
}

// for external services api, token in headers
const authExternalApi = (req: express.Request, res: express.Response, next: any) => {
    let token = req.headers?.authorization
    if (!token)
        return helper.generateErr(res, 'tokenMissing', 403);

    verifyToken(token, req, res, () => {
        if (req.user['info'].accountType !== ACCOUNT_API)
            return helper.generateErr(res, 'forbidden', 403);
        next()
    }, {allowNonWhitelisted: true, api: true})
}

export {auth, authNonWhitelisted, authAnon, authAdmin, authManager, authExternalApi}

