import joi from "joi";

// object id
export const joiIdSchema = joi.string().regex(/^[0-9a-fA-F]{24}$/);

// object id or null
export const joiNullableIdSchema = joi.string().regex(/^0|[0-9a-fA-F]{24}$/);

// wallet address, case-insensitive
export const joiWalletAddress = joi.string().pattern(new RegExp('^0x[a-fA-F0-9]{40}$'));

// string array, example: "abc,dfg,h12"
export const setupStringArray = (joi, separator: string = ',', name: string = 'stringArray') => {
    return {
        base: joi.array(),
        coerce: (value, helpers) => ({
            value: value.split ? value.split(separator) : value,
        }),
        type: name,
    }
}