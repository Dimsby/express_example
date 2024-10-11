import express from "express";
import * as helper from "../../helper";
import User, {
    SOCIAL,
    GENDERS,
    GENDERS_INTERESTED,
    BODY_TYPES,
    ACCOUNT_STREAMER,
    ACCOUNT_ADMIN,
    EWhoCanMessageMe,
    EChatAllowedFor, CONNECTED_API, ACCOUNT_MANAGER, ACCOUNT_VIEWER, EWithdrawPaymentMethods,
} from "../../model/Users";
import BlockUser from "../../model/Block";
import NotificationSettings, { CURRENCY_LIST } from "../../model/NotificationSettings";
import StreamerSettings, {
    IStreamerSettings,
} from "../../model/StreamerSettings";

import { AccessControl } from "accesscontrol";
import Streams from "../../model/Streams";
import { getHash } from "../../utils/passwordHelper";
import { logger } from "../../services/logger";
import performerPackages from "../../model/PerformerPackages";
import { checkPasswordStrength } from "../../utils/passwordStrengthHelper";
import { deleteInDoc } from "../../utils/transformHelper";
import WireTransferSettings, { ETaxStatuses } from "../../model/WireTransferSettings";

const publicSelect = [
    "_id",
    "name",
    "yourBio",
    "birthdate",
    "gender",

    "profileImg",
    "bannerImg",
    "portraitImg",
    "brbImg",
    "profileImgTm",
    "bannerImgTm",
    "portraitImgTm",
    "brbImgTm",
    "streamDefaultImg",
    "streamDefaultImgTm",

    "interestedIn",
    "accountType",
    "social",
    "languages",
    "bodyType",
    "likes",
    "dislikes",
    "onlineStatus",
    "onlineLast",
    "rating",
    "subscribersCount",
    "activeStreamId",
    'totalStreams',
    'lastStreamed',
    'creditsTipped',
    'streamsWatched',
];

const privateSelect = [
    ...publicSelect,
    "address",
    "email",
    "username",
    "balance",
    "streamDefaultImgName",
    "revenueTier",
    "lastStreamName",
    "lastStreamKey",
    "password",
    "connectedApi",
    "isVerified",
    "emailVerificationStartedAt",
    "referralCode",
    "referralFrom",
    "withdrawPaymentMethod"
];
const adminSelect = [
    ...publicSelect,
    "address",
    "email",
    "username",
    "balance",
    "totalHours",
    "revenueTier",
    "connectedApi",
    "hide",
    "withdrawPaymentMethod"
];

// field to remove from output
const privateFields = ['birthdate']

const joi = require("joi");
export const schema = {
    PUT: (isAdmin = false, current) => {
        return joi.object().keys({
            email: joi.string().min(3).email(),
            name: joi.string().min(1).max(60),
            username: joi.string().min(3).max(30),
            yourBio: joi.string().allow('',null),
            birthdate: joi.date(),
            gender: joi.string().valid(...GENDERS).allow('',null),
            interestedIn: joi.string().valid(...GENDERS_INTERESTED).allow('',null),
            languages: joi.array().items(joi.string()).allow('',null),
            bodyType: joi.string().valid(...BODY_TYPES).allow('',null),
            likes: joi.string().allow('',null),
            dislikes: joi.string().allow('',null),
            social: joi
                .object()
                .keys(Object.fromEntries(SOCIAL.map((i) => [i, joi.string().uri()]))),
            connectedApi: joi
                .object()
                .keys(Object.fromEntries(CONNECTED_API.map((i) => [i, joi.string().max(500)]))),
            password: joi.string().min(6).max(40).label("Password"),
            password_confirmation: joi
                .any()
                .equal(joi.ref("password"))
                .label("Confirm password")
                .messages({ "any.only": "{{#label}} does not match" })
                .when("password", { is: joi.exist(), then: joi.required() }),
            address: joi.string().pattern(new RegExp("^0x[a-fA-F0-9]{40}$")),
            ...(isAdmin && {
                revenueTier: joi.number().integer().min(1),
                hide: joi.boolean(),
                accountType: joi.string().valid(ACCOUNT_MANAGER, ACCOUNT_ADMIN, ACCOUNT_STREAMER, ACCOUNT_VIEWER)
            }),
            ...(!isAdmin && current?.password && {
                password_current: joi
                    .any()
                    .label("Current password")
                    .custom((value, helper) => (getHash(value) === current?.password) || helper.message("{{#label}} is wrong")
                    )
                    .when("password", { is: joi.exist(), then: joi.required() })
            }),

            withdrawPaymentMethod: joi.string().valid(...Object.values(EWithdrawPaymentMethods)),

            settings: joi.object().keys({
                starOnlineAlert: joi.boolean(),
                messageAlert: joi.boolean(),
                importantEmailAlert: joi.boolean(),
                showCam: joi.boolean(),
                showGender: joi.array().items(joi.string().valid(...GENDERS)),
                blockCountryList: joi
                    .array()
                    .items(joi.string().case("upper").length(2)),

                enableLockPassword: joi.boolean(),
                lockPassword: joi
                    .string()
                    .max(40)
                    .label("Room Password")
                    .when("enableLockPassword", {
                        is: true,
                        then: joi.required(),
                    }),

                rules: joi.string().min(3).max(1000).allow(""),

                showsAllowed: joi.boolean(),
                privateCostPerMin: joi.number(),
                privateMinBalance: joi.number(),

                privateSpaceCost: joi.number().min(0),

                privacyMessageMe: joi
                    .string()
                    .valid(...Object.values(EWhoCanMessageMe)),
                chatAllowedFor: joi.string().valid(...Object.values(EChatAllowedFor)),

                tiktokCost: joi.number(),
                twitterCost: joi.number(),
                facebookCost: joi.number(),
                instagramCost: joi.number(),
                snapchatCost: joi.number(),

                // withdraw crypto transfer settings
                depositAddress: joi.string().pattern(new RegExp("^0x[a-fA-F0-9]{40}$")).allow(""),
                depositCurrency: joi.string().valid(...CURRENCY_LIST),

            }), wireTransferSettings: joi.object().keys({
                // withdraw wiretransfer settings
                taxStatus: joi.string().valid(...Object.values(ETaxStatuses)),

                beneficiaryName: joi.string().allow(''),
                beneficiaryCountry: joi.string().allow(''),
                beneficiaryState: joi.string().allow(''),
                beneficiaryCity: joi.string().allow(''),
                beneficiaryZip: joi.string().allow(''),
                beneficiaryAddress: joi.string().allow(''),
                accountNumber: joi.string().allow(''),

                bankName: joi.string().allow(''),
                bankRouting: joi.string().allow(''),
                bankSWIFT: joi.string().allow(''),
                bankCountry: joi.string().allow(''),

                correspondingBankName: joi.string().allow(''),
                correspondingBankSWIFT: joi.string().allow(''),
                correspondingAccountNumber: joi.string().allow(''),

                contactFirstName: joi.string().allow(''),
                contactLastName: joi.string().allow(''),
                contactCompanyName: joi.string().allow(''),
                contactCountry: joi.string().allow(''),
                contactState: joi.string().allow(''),
                contactCity: joi.string().allow(''),
                contactZip: joi.string().allow(''),
                contactAddress: joi.string().allow('')
            }),
        });
    },
    GET: () => {
        return joi.object().keys({
            id: joi
                .string()
                .regex(/^0|[0-9a-fA-F]{24}$/)
                .message("Wrong User Id"),
        });
    },
};

const ac = new AccessControl({
    admin: {
        item: {
            "update:any": ["*"],
            "delete:any": ["*"],
            "delete:own": [], // do not allow delete own but anyone else
        },
    },
    streamer: {
        item: {
            "update:own": ["*"],
            "delete:own": ["*"],
        },
    },
    viewer: {
        item: {
            "update:own": ["*"],
            "delete:own": ["*"],
        },
    },
});
ac.grant('manager').extend('admin')
ac.grant('affiliate').extend('viewer')

/**
 * update user
 * PUT /users/:id
 */
export const putAction = async (
    req: express.Request,
    res: express.Response
) => {
    if (helper.validateRequest(schema["GET"](), req.params, res)) return; // to validate id in params

    const { info }: any = req.user;
    const permissionAny = ac.can(info.accountType).updateAny("item");
    // check permissions for any
    if (req.params.id !== "0" && !permissionAny.granted)
        return helper.generateErr(res, "Forbidden", 403);

    if (helper.validateRequest(schema["PUT"](permissionAny.granted, info), req.body, res)) return;

    const userId = req.params.id === "0" ? info._id : req.params.id;

    const data: any = req.body;

    try {
        // managers can change anything except account type
        if (info.accountType == ACCOUNT_MANAGER && data.accountType)
            return helper.generateErr(res, "Forbidden", 403);

        // check "Deposit Address" and "Deposit Currency"
        if (
            data.depositAddress &&
            !data.depositCurrency ||
            data.depositCurrency && !data.depositAddress
        )
            return helper.generateErr(res, "Missing Deposit Address and Deposit Currency", 400);

        // check email is unique
        if (
            data.email &&
            (await User.findOne(
                { email: data.email, _id: { $ne: userId } },
                "_id"
            ).lean())
        )
            return helper.generateErr(res, "This Email is Already Exists", 400);

        // check name is unique
        if (
            data.name &&
            (await User.findOne(
                { name: data.name, _id: { $ne: userId } },
                "_id"
            ).lean())
        )
            return helper.generateErr(res, "This Name is Already Exists", 400);

        if (data.revenueTier && !await performerPackages.checkPackageByTier(data.revenueTier))
            return helper.generateErr(res, { 'revenueTier': 'This revenue tier does not exist' }, 400);

        if (data.password) {
            const passwordWarning: string | false = checkPasswordStrength(data.password, [info.email, info.name])
            if (passwordWarning)
                return helper.generateErr(res, { 'password': passwordWarning }, 400);
            data.password = getHash(data.password)
        }

        // save blocked countries into user
        data.blockCountryList = data.settings?.blockCountryList ?? null

        let user: any = await User.findOneAndUpdate({ _id: userId }, data, {
            new: true,
        });
        if (!user) return helper.generateErr(res, "Update Failed");
        await user.updateOne({ hasAboutMe: user.checkHasAbout() })
        // streamer settings
        if (data.settings) {
            // upsert notification settings for all account types
            await NotificationSettings.findOneAndUpdate(
                { userId: info._id },
                data.settings,
                { upsert: true }
            );

            // upsert streamer settings for streamer account type only
            if (info.accountType == ACCOUNT_STREAMER) {
                const oldPassword: string = (
                    await StreamerSettings.findOne({ userId: info._id }).lean()
                )?.lockPassword;
                const streamerSettings: IStreamerSettings =
                    await StreamerSettings.findOneAndUpdate(
                        { userId: info._id },
                        data.settings,
                        {
                            upsert: true,
                            new: true,
                        }
                    );

                // remove users who entered old password before
                if (
                    streamerSettings.enableLockPassword &&
                    oldPassword &&
                    streamerSettings.lockPassword !== oldPassword
                )
                    await User.findOneAndUpdate(
                        { _id: userId },
                        { $unset: { passwordLockedUsers: 1 } },
                        { new: true }
                    );

                // update locked field of active stream
                if (user.activeStreamId) {
                    await Streams.findOneAndUpdate(
                        { _id: user.activeStreamId },
                        streamerSettings.enableLockPassword
                            ? { locked: true }
                            : { $unset: { locked: 1 } }
                    );
                }
            }
        }

        // wire transfer settings
        if (data.wireTransferSettings) {
            await WireTransferSettings.findOneAndUpdate(
                { userId: info._id },
                data.wireTransferSettings,
                { upsert: true }
            );
        }

        user = await User.findOne({ _id: userId }).select(permissionAny.granted ? adminSelect : privateSelect);
        await user.fillProfile();

        return helper.generateSucc(res, "Updated >>", user);
    } catch (error: any) {
        logger.error(error);
        return helper.generateErr(res, error.message);
    }
};

/**
 * get user profile
 * GET /users/:id
 */
export const getAction = async (
    req: express.Request,
    res: express.Response
) => {
    if (helper.validateRequest(schema["GET"](), req.params, res)) return; // to validate id in params

    const { info }: any = req.user || {};

    if (req.params.id === "0" && !info)
        return helper.generateErr(res, 'Not Authorized', 401);

    const admin: boolean = [ACCOUNT_ADMIN, ACCOUNT_MANAGER].includes(info?.accountType)

    // if params.id is "0", get active user profile
    const my: boolean = info?._id.equals(req.params.id) || req.params.id === '0'
    const userId = my ? info._id : req.params.id;

    try {
        // do not show blocked
        if (
            !my && info &&
            (await BlockUser.isBlockedBy(userId, info._id))
        )
            return helper.generateErr(res, "Blocked", 403);

        // select different field for active or other users profile
        const find: any = await User.findOne({ _id: userId }).select(
            admin
                ? adminSelect
                : my
                    ? privateSelect
                    : publicSelect
        );

        if (!find) return helper.generateErr(res, "User Not Found", 404);

        const guest: any = req['guest']

        // fill images and relation data - my profile filled with additional data
        await find.fillProfile(my ? null : info?._id, !!guest);
        return helper.generateSucc(res, `See object`, find
            ? ((my || admin)
                ? find
                : deleteInDoc(find.toObject(), privateFields))
            : null
        );
    } catch (error: any) {
        logger.error(error)
        return helper.generateErr(res, error.message);
    }
};

/**
 * DELETE /users/:id
 */
export const deleteAction = async (
    req: express.Request,
    res: express.Response
) => {
    if (helper.validateRequest(schema["GET"](), req.params, res)) return; // to validate id in params

    const { info }: any = req.user;

    // check permissions for own
    if (
        req.params.id === "0" &&
        !ac.can(info.accountType).deleteOwn("item").granted
    )
        return helper.generateErr(res, "Forbidden", 403);

    // check permissions for any
    if (
        req.params.id !== "0" &&
        !ac.can(info.accountType).deleteAny("item").granted
    )
        return helper.generateErr(res, "Forbidden", 403);

    const userId = req.params.id === "0" ? info._id : req.params.id;

    try {
        return helper.generateSucc(res, "Deleted", await User.deleteUser(userId));
    } catch (error) {
        logger.error(error);
        return helper.generateErr(res, error.message, 400);
    }
};
