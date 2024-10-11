import zxcvbn, {ZXCVBNResult} from "zxcvbn"
import passwordComplexity, {ComplexityOptions} from "joi-password-complexity"
import Joi from "joi";

const complexityOptions: ComplexityOptions  = {
    min: 6,
    max: 40,
    lowerCase: 1,
    upperCase: 1,
    numeric: 1,
    symbol: 1,
}

const ERROR_DEFAULT: string = 'Try harder password'

/**
 * Check password strength.
 * Return false if strong, string error if not
 *
 * @param password
 * @param userData
 */
export const checkPasswordStrength = (
    password: string,
    userData: string[]
): false | string => {
    // check for symbols
    const complexityReturn: Joi.ValidationResult = passwordComplexity(complexityOptions, 'Password').validate(password)
    if (complexityReturn.error) return complexityReturn.error.details[0]?.message || ERROR_DEFAULT

    // check for common passwords
    const result: ZXCVBNResult = zxcvbn(password, userData)
    if (!result || result.score >= 2) return false

    return result.feedback?.warning || ERROR_DEFAULT
}