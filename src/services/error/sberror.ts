export class SBError extends Error {

    public responseCode: number

    constructor(responseCode: number, ...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params)

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SBError)
        }

        this.name = 'SBError'
        this.responseCode = responseCode
    }
}