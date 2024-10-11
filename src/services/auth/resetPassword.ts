import Users from "../../model/Users";
import {config} from "../../config";
import jwt from "jsonwebtoken";
import {sendServiceMail} from "../mail";
import {getHash} from "../../utils/passwordHelper";
import {logger} from "../logger";
import {SBError} from "../error/sberror";

interface ITokenPayload {
    id: string // user id
    key: string // key to ensure one-time reset link use
}

// PRIVATE

/**
 * Returns frontend link for email
 * @param token
 */
const _getLink = (token: string): string => `${config.app.frontend_url}/reset?t=${token}`

/**
 * Encodes payload and generates token for password reset
 * @param payload
 * @throws error if token generation failed
 * @returns token
 */
const _getToken = (payload: ITokenPayload) => new Promise<string>((resolve, reject) => {
    jwt.sign(payload, config.auth.jwt_secret, {expiresIn: config.auth.jwt_expire_password_reminder},
        (err, token: string) => err ? reject(err) : resolve(token)
    )
})

/**
 * Checks if token valid and returns decoded payload
 * @param token
 * @throws exception if token is wrong
 * @returns ITokenPayload decoded token payload
 */
const _verifyToken = (token: string) => new Promise<ITokenPayload>((resolve, reject) => {
    jwt.verify(token, config.auth.jwt_secret,
        (err: any, decoded: any) => err ? reject(err) : resolve(decoded)
    )
})

const _testPayload = (user: any, payload: ITokenPayload): boolean => (user.passwordResetAttempts == payload.key)

// PUBLIC

/**
 * Send email and process user attempts
 * @param email
 * @throws SBError exception for logic error
 * @return email text
 */
const sendEmail = async (email: string): Promise<string | void> => {
    const user: any = await Users.findOne({email: email}, '_id password passwordResetStartedAt passwordResetAttempts')
    if (!user)
        throw new SBError(404, 'Not Found')

    const data: any = {}

    // process reset attempts number and reset date
    if (!user.passwordResetAttempts) // if first time password reset
        data.passwordResetAttempts = 1
    else if (user.passwordResetAttempts >= config.auth.reset_max_attempts) { // if more than maxResetAttempts reset attempts
        // if resetBanTimeMs has passed since last 5 reset attempts - allow to start again
        if (user.passwordResetStartedAt && (Date.now() - user.passwordResetStartedAt) > config.auth.reset_ban_time) {
            data.$unset = {passwordResetStartedAt: 1}
            data.passwordResetAttempts = 1
        } else {
            data.passwordResetStartedAt = Date.now() // set idle timer, reset not allowed during resetBanTimeMs
            throw new SBError(429, 'Too many reset requests')
        }
    } else {
        // increment attempt
        data.passwordResetAttempts = user.passwordResetAttempts+1
    }

    // update user with new passwordResetAttempts and passwordResetStartedAt
    if (data) await user.update(data)

    // get token and link
    const token: string = await _getToken({
        id: user._id,
        key: data.passwordResetAttempts
    })
    const link: string = _getLink(token)

    sendServiceMail({
        to: email,
        subject: 'Password Reset',
        text: `Copy link to browser to reset password: ${link}`, // text fallback
        template: 'forgot_pwd',
        context: {link: link}
    }).catch((err: any) => {
        logger.error('Reset password mail error', err, email)
    })

    if (config.app.api_testing) return link
}

/**
 * Checks if given token (from email link) is correct
 * @param token
 */
const checkLink = async (token: string): Promise<boolean | number> => {
    const data: ITokenPayload = await _verifyToken(token)
    const user: any = await Users.findById(data.id, '_id passwordResetAttempts').lean()
    if (!user || !_testPayload(user, data)) return false

    return user._id
}

export default {sendEmail, checkLink}