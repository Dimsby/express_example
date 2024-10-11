import joi from "joi";
import {ACCOUNT_AFFILIATE, ACCOUNT_STREAMER, ACCOUNT_VIEWER} from "../../model/Users";

const joiSchema = {
    name: joi.string().min(2).max(50),
    email: joi.string().min(2).max(50),

    createdAtStart: joi.date(), // Registration Date
    createdAtEnd: joi.date(),
    onlineLastStart: joi.date(), // Last Login Date
    onlineLastEnd: joi.date(),
    lastStreamedStart: joi.date(), // Last Streamed Date
    lastStreamedEnd: joi.date(),

    accountType: joi.string().valid(ACCOUNT_VIEWER, ACCOUNT_STREAMER, ACCOUNT_AFFILIATE),
    onlineStatus: joi.boolean(),
    idsVerified: joi.boolean(), // Is Active, if id docs verified
    isVerified: joi.boolean(), // Is Email Verified

    signupSource: joi.string().valid('affiliate', 'direct') // Signup Source
}

const filterSearchFields: string[] = ['name', 'email']
const filterDateFields: string[] = ['createdAt', 'onlineLast', 'lastStreamed']
const filterValueFields: string[] = ['accountType', 'onlineStatus', 'idsVerified', 'isVerified']

export default {joiSchema, filterSearchFields, filterDateFields, filterValueFields}

