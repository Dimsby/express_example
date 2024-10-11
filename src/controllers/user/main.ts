import express from "express";
import * as helper from "../../helper";
import User, {
  ACCOUNT_ADMIN,
  ACCOUNT_AFFILIATE,
  ACCOUNT_MANAGER,
  ACCOUNT_STREAMER,
  ACCOUNT_VIEWER,
  GENDERS,
} from "../../model/Users";
import { fillFileFields } from "../../services/upload";
import BlockUser from "../../model/Block";
import { joiIdSchema, setupStringArray } from "../../utils/joiHelper";
import { getSearchCriteria } from "../../utils/searchHelper";
import StreamViewers from "../../model/StreamViewers";
import mongoose from "mongoose";
import { logger } from "../../services/logger";

const joi = require("joi").extend((joi) => setupStringArray(joi));

const sortableFields = [
  "rating",
  "createdAt",
  "name",
  "email",
  "balance",
  "totalHours",
  "lastStreamed",
  "totalStreams",
  "idsVerified",
];

export const schema = {
  GET: () => {
    return joi.object().keys({
      address: joi.string(),
      order: joi.string(),
      accountType: joi
        .string()
        .valid(
          ACCOUNT_VIEWER,
          ACCOUNT_STREAMER,
          ACCOUNT_ADMIN,
          ACCOUNT_AFFILIATE
        ),
      // joi.string().valid(...GENDERS)
      gender: joi.alternatives().try(
        joi
          .stringArray()
          .items(joi.string().valid(...GENDERS))
          .single(),
        joi.string().valid(...GENDERS)
      ),
      emailVerified: joi.boolean(),
      idsVerified: joi.boolean().allow(""),
      viewersOf: joiIdSchema,
      online: joi.boolean(),
      withImage: joi.boolean(),
      skip: joi.number().integer().min(0),
      limit: joi.number().integer().min(0).max(100),
      search: joi.string().max(30),
      name: joi.string().max(30),
      email: joi.string().max(30),
      balance: joi.number().min(0),
      totalHours: joi.number().min(0),
      count: joi.boolean(),
      totalHoursFrom: joi.string(),
      totalHoursTo: joi.string(),
      referralFrom: joiIdSchema,
      profileImg: joi.boolean(),
      bannerImg: joi.boolean(),
      yourBio: joi.boolean(),
      hasTipMenu: joi.boolean(),
      hasPrivateSpace: joi.boolean(),
      hasAboutMe: joi.boolean(),
      social: joi.boolean(),
    });
  },
};

const selectFields = [
  "_id",
  "name",
  "gender",
  "profileImg",
  "accountType",
  "onlineStatus",
  "onlineLast",
  "rating",
  "subscribersCount",
  "activeStreamId",
];
const adminSelectFields = [
  ...selectFields,
  "hide",
  "birthdate",
  "email",
  "address",
  "username",
  "balance",
  "createdAt",
  "whitelisted",
  "totalStreams",
  "lastStreamed",
  "totalHours",
  "revenueTier",
  "ids",
  "idsVerified",
  "viewHours",
  "favoritePerformer",
  "creditsBought",
  "creditsEarned",
  "isVerified",
  "yourBio",
  "social",
  "affiliateFixedPaid",
  "withdrawPaymentMethod",
  "affiliatedStreamers",
  "affiliatedViewers",
  "affiliatedAffiliaters",
  "bannerImg",
  "hasTipMenu",
  "hasPrivateSpace",
  "hasAboutMe",
];

/**
 * GET /users
 * user listing
 */
export const getAction = async (
  req: express.Request,
  res: express.Response
) => {
  if (helper.validateRequest(schema["GET"](), req.query, res)) return;

  const {
    address,
    email,
    name,
    balance,
    totalHours,
    accountType,
    withImage,
    online,
    search,
    skip,
    limit,
    idsVerified,
  } = req.query;
  const {
    totalHoursFrom,
    totalHoursTo,
    viewersOf,
    emailVerified,
    referralFrom,
    profileImg,
    bannerImg,
    yourBio,
    hasTipMenu,
    hasPrivateSpace,
    hasAboutMe,
    social,
  } = req.query; // admin only

  const { info }: any = req.user || {};
  const guest: any = req["guest"];

  let select = selectFields;
  let adminSelect = adminSelectFields;

  const isAdmin = [ACCOUNT_ADMIN, ACCOUNT_MANAGER].includes(info?.accountType);

  const count = req.query?.count == "true";

  let order = req.query.order;
  if (!isAdmin && order == "rating") order = "-rating";

  const searchFields = ["name", "email"];

  const searchCriteria = search
    ? {
        $regex: ".*" + helper.escapeRegex(search as string) + ".*",
        $options: "i",
      }
    : null;

  let gender: string | Array<string> = req.query.gender as string;
  if (gender && gender.search(",")) gender = gender.split(",");

  const filter: any = {
    accountType: accountType
      ? isAdmin && accountType === ACCOUNT_ADMIN
        ? { $in: [ACCOUNT_ADMIN, ACCOUNT_MANAGER] }
        : accountType
      : { $nin: [ACCOUNT_ADMIN, ACCOUNT_MANAGER] },
    ...(address && { address }),
    ...(gender &&
      (Array.isArray(gender) ? { gender: { $in: gender } } : { gender })),
    ...(search && {
      $or: searchFields.map((fieldName) => {
        return { [fieldName]: searchCriteria };
      }),
    }),

    ...(email && { email: getSearchCriteria(email) }),
    ...(balance && { balance }),
    ...(totalHours && { totalHours }),
    ...(isAdmin && idsVerified && { idsVerified }), // depending on the filter from AP
    ...(!isAdmin && { idsVerified: { $ne: false } }), // only verified streamers should be displayed in FE
  };

  if (!isAdmin) {
    if (info?.country) filter["blockCountryList"] = { $ne: info.country };
    else if (guest?.country)
      filter["blockCountryList"] = { $ne: guest.country };
  }

  if ("idsVerified" in req.query) {
    filter.idsVerified = idsVerified === "" ? null : idsVerified;
  }

  const andFilter = [];

  // filter by name: for admin by name or id, others by name only
  if (name) {
    if (isAdmin)
      andFilter.push({
        $or: [
          { name: getSearchCriteria(name) },
          ...(mongoose.isValidObjectId(name) ? [{ _id: name }] : []),
        ],
      });
    else filter["name"] = getSearchCriteria(name);
  }

  // by online status (value is string)
  if (online == "true") filter["onlineStatus"] = true;
  else if (online == "false") filter["onlineStatus"] = false;

  // have any of image
  if (withImage == "true") {
    if (!filter["$or"]) filter["$or"] = [];
    filter["$or"].push({ profileImg: { $exists: true } });
    filter["$or"].push({ bannerImg: { $exists: true } });
    filter["$or"].push({ portraitImg: { $exists: true } });
    filter["$or"].push({ streamDefaultImg: { $exists: true } });
    select = [
      "_id",
      "profileImg",
      "bannerImg",
      "portraitImg",
      "streamDefaultImg",
    ];
  }
  try {
    if (isAdmin) {
      // find stream viewers
      if (viewersOf) {
        const viewers = await StreamViewers.getViewerIds(
          new mongoose.Types.ObjectId(viewersOf as string)
        );
        filter["_id"] = { $in: viewers };
      }
      // email verification
      if (emailVerified !== undefined) {
        filter["isVerified"] =
          emailVerified === "true" ? true : { $in: [null, false] };
      }
      if (referralFrom) filter["referralFrom"] = referralFrom;

      if (profileImg) filter["profileImg"] = { $exists: profileImg === "true" };
      if (bannerImg) filter["bannerImg"] = { $exists: bannerImg === "true" };
      if (yourBio) filter["yourBio"] = { $exists: yourBio === "true" };

      if (hasTipMenu) filter["hasTipMenu"] = hasTipMenu === "true";
      if (hasPrivateSpace)
        filter["hasPrivateSpace"] = hasPrivateSpace === "true";
      if (hasAboutMe) filter["hasAboutMe"] = hasAboutMe === "true";

      if (social)
        filter["social"] = { [social === "true" ? "$nin" : "$in"]: [null, {}] };
    } else {
      // filter users that blocked me
      if (info) {
        const blockedMe = await BlockUser.getIdsWhoBlocked(info._id);
        if (blockedMe) filter["_id"] = { $nin: blockedMe };
      }
    }

    if (andFilter.length) filter["$and"] = andFilter;

    // prepare user query
    const userQuery = User.find(filter).select(isAdmin ? adminSelect : select); // '-address -password -nonce -__v -token -onlineId'

    // count users for admin only
    const total = count ? await User.count(userQuery) : null;

    if (isAdmin) {
      userQuery.populate("referralFrom", "_id name email accountType");
      userQuery.populate("favoritePerformer", "_id name");
    }

    const users = await userQuery
      .sort((order as string) || "name")
      .limit(limit ? +limit : 100)
      .skip(skip ? +skip : 0);
    if (!users) return helper.generateSucc(res, "No users", []);

    let blockedIds;
    if (info) blockedIds = await BlockUser.getBlockedIds(info._id);

    const promises = [];
    users.forEach((user) => {
      // add profile image addresses
      if (user["profileImg"]) fillFileFields(user, "profileImg", "users");
      if (withImage) {
        if (user["bannerImg"])
          fillFileFields(user, "bannerImg", "users", "banner");
        if (user["portraitImg"])
          fillFileFields(user, "portraitImg", "users", "portrait");
        if (user["streamDefaultImg"])
          fillFileFields(user, "streamDefaultImg", "users", "stream");
      }
      // flag users that I block
      if (blockedIds) user.fillIsBlocked(blockedIds);
      // add isSub flag
      if (info) promises.push(user.fillIsSub(info._id));

      // add totalHoursRange field
      if (isAdmin) {
        if (totalHoursFrom) {
          promises.push(
            user.fillTotalHoursRange(
              new Date(totalHoursFrom as string),
              totalHoursTo ? new Date(totalHoursTo as string) : null
            )
          );
        }

        promises.push(user.fillSettings("depositCurrency depositAddress"));

        if (accountType == ACCOUNT_AFFILIATE)
          user["affiliateUsedTools"] = {
            api: 0,
            banner: 0,
            camListing: 0,
            camEmbed: 0,
            IM: 0,
            popup: 0,
            rss: 0,
            text: 0,
          };
      }
    });

    // for isSub flag and totalHoursRange
    if (promises.length) await Promise.all(promises);

    // for admin return users list and total users value
    return helper.generateSucc(
      res,
      "See objects",
      count ? { users, total } : users
    );
  } catch (error) {
    logger.error(error);
    return helper.generateErr(res, error.message, 400);
  }
};
