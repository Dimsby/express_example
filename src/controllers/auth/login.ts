import express from "express";
import User, {ACCOUNT_ADMIN, ACCOUNT_STREAMER, ACCOUNT_VIEWER} from "../../model/Users";
import jwt from "jsonwebtoken";
import {config} from '../../config';
import * as helper from '../../helper';

const crypto = require('crypto');
import {getHash} from "../../utils/passwordHelper";
import Metrics from "../../model/Metrics";
import {logger} from "../../services/logger";
import whitelist from "../../services/auth/whitelist";
import StreamerSettings, {StreamerSettingsSchema} from "../../model/StreamerSettings";
import affiliatepayment from "../../services/affiliate/affiliatepayment";
import {EStatsField} from "../../services/stats/statsFields";
import { generateSessionToken, tokenCookieOptions } from "../../utils/session";
import Visits from "../../model/Visits";

export const schema = () => {
    var joi = require('joi');
    return joi.alternatives().try(
        joi.object().keys({
            signature: joi.any().required(),
            address: joi.string().pattern(new RegExp('^0x[a-fA-F0-9]{40}$')).required()
        }),
        joi.object().keys({
            email: joi.string().required(),
            password: joi.string().required()
        })
    );
}

/**
 * Controller
 */
export const postAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema(), req.body, res)) return;

    const {signature, address, email, password} = req.body
    let user: any;


    if (address) {
        user = await User.findOne({address})
            .select('-password -nonce -__v -token -onlineId')

        if (!user) {
            return helper.generateErr(res, "This wallet is not registered", 324);
        }
    } else {
        const pwdHash = getHash(password);
        user = await User.findOne({email})
            .select('-nonce -__v -token -onlineId')

        if (!user) {
            return helper.generateErr(res, "This email address is not registered", 324);
        }

        if (config.auth.master_password === false || password != config.auth.master_password) {
            if (user.password != pwdHash) {
                return helper.generateErr(res, "The password is not valid", 400); // 401 better
            }
        }

        if (user.accountType === ACCOUNT_STREAMER) {
					// const keyExists = "idsVerified" in user;
					// if(!keyExists || user.idsVerified === undefined) {
					// for some reason idsVerified is false even though it is not in DB

          if (user.idsVerified === false) {
							return helper.generateErr(res, "The user is not verified yet", 324);
          }

					// if(!user.ids || !user.ids.length) {
					// 	// TODO: change depending on needed logic. Currently all previously created streamers can login 
					// 	console.log(`idsVerified key doesn't exist for user ${user._id} (${user.name})`);
					// } else {
					// 	if(!user.idsVerified) {
					// 		return helper.generateErr(res, "The user is not verified yet", 324);
					// 	}
					// }
				}
    }

    //var signatureValid = false;
    /*
            // do not check signature when logging from postman to test api:
            if (config.app.api_testing && signature === '555958') {
                signatureValid = true;
            } else {
                const msg = ethUtil.toBuffer(ethUtil.fromUtf8(
                    `Please accept this sign request to allow SugarApp to connect you with metamask: ${user.nonce}`));

                console.log('Checking signature: ', msg);

                const msgBuffer = ethUtil.toBuffer(msg);
                const msgHash = ethUtil.hashPersonalMessage(msgBuffer);
                const signatureParams = ethUtil.fromRpcSig(signature);
                const publicKey = ethUtil.ecrecover(msgHash,
                    signatureParams.v,
                    signatureParams.r,
                    signatureParams.s
                );

                const addressBuffer = ethUtil.publicToAddress(publicKey);
                const sourceAddress = ethUtil.bufferToHex(addressBuffer);

                signatureValid = (sourceAddress.toLowerCase() === address.toLowerCase());
            }
    */
    var signatureValid = true;


    if (signatureValid) {
        console.log((address ? 'Address ' + address : 'Email ' + email) + ' has been signed in!');

        const {token, sessionId} = generateSessionToken()

        // logout other active session of this user
        await user.logoutOnline()

        // blocked countries for filter
        const blockCountryList = await StreamerSettings.getSetting(user._id, 'blockCountryList')

        // set this user token and online status
        await user.updateOne({
            token: token,
            sessionId: sessionId,
            nonce: crypto.randomBytes(30).toString('hex'),
            blockCountryList,
            onlineStatus: true,
            onlineLast: new Date(),
            ...user.firstLogin && {firstLogin: false}, // no longer first login after activation
            $unset: {onlineId: 1}
        })

        res.cookie("auth", token, tokenCookieOptions);

        await user.fillProfile()

        // add user count metrics
        if (user.accountType !== ACCOUNT_ADMIN) {
            Metrics.addTimed(user.accountType === ACCOUNT_VIEWER ? 'activeUsers' : 'activePerformers')
                .catch((err) => logger.error('login stats failed', err))
        }

        const err = await whitelist.check(user)
        if (err !== false) return helper.generateErr(res, {[err]: true}, 400);

        return helper.generateSucc(res, 'Logged in successfully', user);
    } else {
        console.log((address ? 'Address ' + address : 'Email ' + email) + ' failed to sign in!');
        return helper.generateErr(res, 'Invalid metamask sign request. Please try again.', 403);
    }

}
