import express from "express";
import User, { ACCOUNT_AFFILIATE, ACCOUNT_STREAMER, ACCOUNT_VIEWER, GENDERS } from "../../model/Users";
import Stats from "../../model/Stats";
import * as helper from '../../helper';
import { config } from '../../config';
import { getHash } from "../../utils/passwordHelper";
import { logger } from "../../services/logger";
import { uploadFiles } from "../../services/upload";
import verifyEmail from "../../services/auth/verifyEmail";
import { getUniqueCriteria } from "../../utils/searchHelper";
import affiliateuser from "../../services/affiliate/affiliateuser";
import { checkPasswordStrength } from "../../utils/passwordStrengthHelper";
import { conversationTrackingRequest } from "../../utils/conversionTrackingRequest";

const crypto = require('crypto');

export const uploadDir: string = 'userID'
export const fieldName: string = 'image'

export const schema = () => {
  const joi = require('joi');
  const currentYear = new Date().getFullYear()
  return joi.object().keys({
    email: joi.string().email().required(),
    name: joi.string().min(1).max(30).required(),
    username: joi.string().min(3).max(60),
    accountType: joi.string().valid(ACCOUNT_STREAMER, ACCOUNT_VIEWER, ACCOUNT_AFFILIATE).required(),
    // gender: joi.string().valid(...GENDERS).required(),
    // day: joi.number().integer().min(1).max(31).required(),
    // month: joi.number().integer().min(1).max(12).required(),
    // year: joi.number().integer().min(1900).max(currentYear - 18).required(),
    check: joi.bool().invalid(false).required(),
    password: joi.string().min(6).max(40).label('Password'),
    password_confirmation: joi.any().equal(joi.ref('password'))
      .label('Confirm password')
      .messages({ 'any.only': '{{#label}} does not match' })
      .when('password', { is: joi.exist(), then: joi.required() }),
    address: joi.string().pattern(new RegExp('^0x[a-fA-F0-9]{40}$'))
      .when('password', { not: joi.exist(), then: joi.required() }),
  });
}

const transformErrors = (errors: Object): Object => {
  const entries = Object.entries(errors).map(([key, value]) => {
    return typeof value === "string" ? [key, value] : [key, `${key} is invalid`]
  });

  return Object.fromEntries(entries);
}

export const validateAction = async (req: express.Request, res: express.Response) => {
  if (helper.validateRequest(schema(), req.body, res)) return;

  const { email, name, address, accountType, password } = req.body

  const passwordAuth = (password);

  // check for existing user
  if (passwordAuth) {
    if (await User.findOne({ email: getUniqueCriteria(email) }, '_id').lean())
      return helper.generateErr(res, { email: "This user is registered already" }, 401);
    const passwordWarning: string | false = checkPasswordStrength(password, [email, name])
    if (passwordWarning)
      return helper.generateErr(res, { password: passwordWarning }, 401);
  } else {
    if (await User.findOne({ address: getUniqueCriteria(address) }, '_id').lean())
      return helper.generateErr(res, { email: "This wallet already exists" }, 401);
    // check unique email
    if (await User.findOne({ email: getUniqueCriteria(email) }, '_id').lean())
      return helper.generateErr(res, { email: "Email is not unique" }, 400);
  }

  // check unique name
  if (await User.findOne({ name: getUniqueCriteria(name) }, '_id').lean())
    return helper.generateErr(res, { name: "Name is not unique" }, 400);

  const testUser = new User({
    name: name.toLowerCase(),
    email: email.toLowerCase(),
    accountType,
    age: true,
    password: password ? getHash(password) : null,
    nonce: crypto.randomBytes(30).toString('hex'),
    address,
  });

  const error = testUser.validateSync();

  if (error) {
    return helper.generateErr(res, transformErrors(error.errors), 400);
  }

  return helper.generateSucc(res, 'Validation Successful', { valid: true });
}

export const postAction = async (req: express.Request, res: express.Response) => {
  return uploadFiles(req, res, {
    uploadDir: uploadDir,
    fieldName: fieldName,
  }, async (files, body) => {
    try {
      if (helper.validateRequest(schema(), body, res)) return;

      const { email, name, address, accountType, password } = body
      const passwordAuth = (password);

      if (!files?.length && accountType === ACCOUNT_STREAMER) { // streamer is required to uploads their IDs
        return helper.generateErr(res, "No files uploaded", 400);
      }

      // check for existing user
      if (passwordAuth) {
        if (await User.findOne({ email: getUniqueCriteria(email) }, '_id').lean())
          return helper.generateErr(res, "This user is registered already", 401);
        const passwordWarning: string | false = checkPasswordStrength(password, [email, name])
        if (passwordWarning)
          return helper.generateErr(res, { password: passwordWarning }, 401);
      } else {
        if (await User.findOne({ address: getUniqueCriteria(address) }, '_id').lean())
          return helper.generateErr(res, "This wallet already exists", 401);
        // check unique email
        if (await User.findOne({ email: getUniqueCriteria(email) }, '_id').lean())
          return helper.generateErr(res, { email: "Email is not unique" }, 400);
      }

      // check unique name
      if (await User.findOne({ name: getUniqueCriteria(name) }, '_id').lean())
        return helper.generateErr(res, { name: "Name is not unique" }, 400);

      const stats = await Stats.create({});
      const user: any = await User.create({
        name: name.toLowerCase(),
        email: email.toLowerCase(),
        stats: stats._id,
        accountType,
        // gender,
        // birthdate: `${year}-${month}-${day}`,
        age: true,
        password: password ? getHash(password) : null,
        nonce: crypto.randomBytes(30).toString('hex'),
        address,
        ...(req.cookies?.referral) && { referralFrom: await affiliateuser.getReferralUser(req.cookies.referral) },
        ...(req.cookies?.source && User.checkReferralSourceTool(req.cookies.source)) && { referralSourceTool: req.cookies.source },
        ...(req.cookies?.click_id) && { referralClickId: req.cookies.click_id },
        ...(accountType == ACCOUNT_STREAMER) && ({
          broadcastId: await User.generateBroadcastId(),
          idsVerified: false,
          ids: files.map((f) => {
            const index = f.filename.lastIndexOf('.')

            return {
              file: f.filename.substr(0, index),
              ext: f.filename.substr(index + 1),
            }
          }),
        }),
      });

      // update user totals
      User.updateTotals(accountType, user).catch((err) => logger.error('Failed updateTotals', err))

      // send verification email
      const link = verifyEmail.sendEmail(user['email']);

      // if referralFrom is set delete referral cookie
      if (user.referralFrom) {
        res.clearCookie("referral");
      }
      if (user.referralSourceTool) {
        res.clearCookie("source");
      }
      if (user.referralClickId) {
        res.clearCookie("click_id");
      }

      conversationTrackingRequest({ type: "free", cid: user._id, ...req.cookies?.click_id && {clickId: req.cookies.click_id} })
          .then(() => console.log('conversion tracking send'))

      return helper.generateSucc(
        res,
        'Signup Successful',
        config.app.api_testing ? { ...(user.toObject()), link } : user
      );
    } catch (error) {
      return helper.generateErr(res, error.message, 400);
    }
  })

  /*
  User.findOne({
      address,
  }).then(async (user) => {
      if (user) {
          return helper.generateErr(res, "This wallet already exists", 401);
      } else {
          //*console.log('Account verification token:', token)
          mail.sendServiceMail(
              email,
              'Account Verification',
              'register',
              {
                  backend_url: config.app.backend_url,
                  token: token
              }
          );//*

          // generate one-time nonce
          const nonce = crypto.randomBytes(30).toString('hex');

          const stats = await Stats.create({});
          stats.save();

          const user = await User.create({
              name,
              email,
              stats: stats._id,
              accountType,
              gender,
              birthdate: `${year}-${month}-${day}`,
              age: true,
              nonce,
              address,
          });
          user.save().then((user) => {
              helper.generateSucc(res, 'Signup Sucessful', user);
          });

      }
  }); */
}

