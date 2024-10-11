import express from "express";
import * as helper from "../../helper";
import joi from "joi";
import {SBError} from "../../services/error/sberror";
import {logger} from "../../services/logger";
import verifyEmail from "../../services/auth/verifyEmail";
import {config} from "../../config";
import User, {ACCOUNT_VIEWER} from "../../model/Users";
import Transactions, {EAction, EPaymentMethod} from "../../model/Transactions";
import affiliatepayment from "../../services/affiliate/affiliatepayment";

export const schema = {
    GET: () => {
        return joi.object().keys({
            token: joi.string().required()
        });
    },
}

/**
 * GET /auth/verify/:token
 * Verify user by token
 *
 * @param req
 * @param res
 */
export const getAction = async (req: express.Request, res: express.Response) => {
    if (helper.validateRequest(schema['GET'](), req.params, res)) return;

    try {
        const userId = await verifyEmail.checkLink(req.params.token);
        if (!userId) {
            return helper.generateErr(res, 'Code expired or wrong', 400);
        }

        const user: any = await User.findById(userId);
        if (!user) {
            return helper.generateErr(res, 'User not found', 404);
        }

        if (user['isVerified']) {
            return helper.generateErr(res, 'Email has already been verified', 400)
        }

        const updated = await user.updateOne({isVerified: true}, {new: true});

        // pay signup bonus
        Transactions.processAction({
            action: EAction.Added,
            user: user._id,
            tipAmount: 10,
            paymentMethod: EPaymentMethod.VERIFY_BONUS
        })
            .then((res) => console.log('Signup bonus paid', res, userId))
            .catch((e) => logger.error('Signup bonus failed', e, userId))

        // pay fixed affiliate for viewer ref
        if (user.accountType == ACCOUNT_VIEWER)
            affiliatepayment.payFixed(user, false)
                .then((res) => console.log('Affiliate verify email paid', res, userId))
                .catch((e) => logger.error('Affiliate verify email failed', e, userId))

        return helper.generateSucc(res, 'Verified', updated)
    } catch (error) {
        if (error! instanceof SBError) logger.error(error)
        return helper.generateErr(res, error.message, error.responseCode || 400);
    }
}

/**
 * POST /auth/verify
 * Resend verification email
 *
 * @param req
 * @param res
 */
export const postAction = async (req: express.Request, res: express.Response) => {
    const {info}: any = req.user;

    try {
        if (info.isVerified)
            return helper.generateErr(res, 'Email has already been verified', 400);

        const link = await verifyEmail.sendEmail(info.email);

        return helper.generateSucc(
            res,
            'Verification email send',
            config.app.api_testing ? link : null
        );
    } catch (error) {
        if (error! instanceof SBError) logger.error(error)
        return helper.generateErr(res, error.message, error.responseCode || 400);
    }
}