import Users from "../../model/Users";
import {config} from "../../config";
import jwt from "jsonwebtoken";
import {sendServiceMail} from "../mail";
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
const _getAuthLink = (token: string): string => `${config.app.frontend_url}/verify/${token}`

/**
 * Encodes payload and generates token for password reset
 * @param payload
 * @throws error if token generation failed
 * @returns token
 */
const _getToken = (payload: ITokenPayload, options = {}) => new Promise<string>((resolve, reject) => {
    jwt.sign(payload, config.auth.jwt_secret, options,
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

const _testPayload = (user: any, payload: ITokenPayload): boolean => (user.emailVerificationAttempts == payload.key)

// PUBLIC

/**
 * Send verification email and process user attempts
 * @param email
 * @throws SBError exception for logic error
 * @return email text
 */
const sendEmail = async (email: string): Promise<string | void> => {
	const user: any = await Users.findOne({email: email}, '_id emailVerificationStartedAt emailVerificationAttempts')
	if (!user)
		throw new SBError(404, 'Not Found')

    const data: any = {}

  	// process email verification attempts number and verification date
	if (!user.emailVerificationAttempts) {// if first time verifying email
		data.emailVerificationAttempts = 1
        data.emailVerificationStartedAt = Date.now()
	} else if (user.emailVerificationAttempts >= config.auth.verify_email_max_attempts) { // if more than max attempts
		// if verify_email_ban_time has passed since last 5 verify attempts - allow to start again
		if (user.emailVerificationStartedAt && (Date.now() - user.emailVerificationStartedAt) > config.auth.verify_email_ban_time) {
			data.$unset = {emailVerificationStartedAt: 1}
			data.emailVerificationAttempts = 1
		} else {
			data.emailVerificationStartedAt = Date.now() // set idle timer, reset not allowed during verify_email_ban_time
			throw new SBError(429, 'Too many email verification requests')
		}
	} else {
		// increment attempt
		data.emailVerificationAttempts = user.emailVerificationAttempts+1
        data.emailVerificationStartedAt = Date.now()
	}

	// update user with new emailVerificationAttempts, emailVerificationStartedAt
	if (data) await user.update(data)

	const token = await _getToken({
		id: user._id,
		key: data.emailVerificationAttempts
	}, {
		expiresIn: config.auth.jwt_expire_email_validation
	})
	const link = _getAuthLink(token)

	sendServiceMail({
		to: email,
		subject: 'Account Verification',
		text: `Copy link to browser for account verification: ${link}`, // text fallback
		template: 'register',
		context: {link}
	}).catch((e) => logger.error('Account Verification Email failed', e))

	if (config.app.api_testing) return link
}


/**
 * Checks if given token (from email link) is correct
 * @param token
 */
 const checkLink = async (token: string): Promise<boolean | number> => {
    const data: ITokenPayload = await _verifyToken(token)
    const user: any = await Users.findById(data.id, '_id emailVerificationAttempts').lean()
    if (!user || !_testPayload(user, data)) return false

    return user._id
}

export default { sendEmail, checkLink }