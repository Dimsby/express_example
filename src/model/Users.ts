import mongoose from "mongoose";
import { differenceInYears } from "date-fns";

import { formatDate } from "../utils/timeHelper";

export const ACCOUNT_USER = "user"
export const ACCOUNT_ADMIN = "admin"
export const ACCOUNT_GUEST = "guest"


// properties and methods
interface IUser {
    fillSettings(customSelect?: string): any;
}

// statics
interface IUserModel extends mongoose.Model<IUser> {
    
    logout(
        id: mongoose.Types.ObjectId | Array<mongoose.Types.ObjectId>,
        accountType?: string
    )
    updateTotals(accountType: string, addOne?: boolean | any): Promise<void>

    deleteUser(userId: mongoose.Types.ObjectId)

    searchIds(search: string, limit?: number): Promise<Array<mongoose.Types.ObjectId>>

    searchIdsMultipleField(input: { [key: string]: any }, fields: string | string[], limit?: number): Promise<Array<mongoose.Types.ObjectId>>
}

export const UserSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true },
        name: { type: String, required: true, get: titleCase },
        username: { type: String, required: false },
        address: { type: String, unique: true, sparse: true },
        password: { type: String },

        accountType: {
            type: String,
            enum: [ACCOUNT_ADMIN, ACCOUNT_USER],
            required: true,
            index: true,
        },

        isVerified: {
            type: Boolean,
            default: false,
        },
        resetToken: {
            type: Number,
        },
        resetTokenExpiration: {
            type: Number,
        },
        token: {
            type: String,
        },

        passwordResetStartedAt: { type: Date },
        passwordResetCompletedAt: { type: Date },
        passwordResetAttempts: { type: Number },

        emailVerificationStartedAt: { type: Date },
        emailVerificationAttempts: { type: Number },

        passwordLockedUsers: {
            type: [mongoose.Schema.Types.ObjectId],
            index: true,
            select: false,
        },
    },
    {
        toJSON: { virtuals: true, getters: true },
        toObject: { virtuals: true, getters: true },
        id: false,
        timestamps: true,
    }
);

UserSchema.virtual("settings");
UserSchema.virtual("adjustedSocial");


/**
 * Called on socket.io connection heartbeat
 * @param userId userId from query params
 * @param ip
 */
UserSchema.statics.onHeartbeat = async function (
    userId: mongoose.Types.ObjectId | string,
    ip?: string
) {
    return this.updateOne(
        { _id: userId },
        {
            onlineStatus: true,
            onlineLast: new Date(),
            ipAddress: ip
        }
    );
};

/**
 * Logouts users with given id or ids. Keep auth token
 *
 * @param id user id or array of ids
 * @param accountType type of user(s) to logout
 */
UserSchema.statics.logout = async function (
    id: mongoose.Types.ObjectId | Array<mongoose.Types.ObjectId>,
    accountType?: string
) {
    const ids = Array.isArray(id) ? id : [id];
    if (ids.length === 0) return;

    // set online status to false
    await this.updateMany(
        { _id: { $in: ids } },
        {
            onlineStatus: false,
            $unset: { onlineId: 1 }, // unset socket ids
        }
    );
};


function titleCase(str: string): string {
    var splitStr = str.toLowerCase().split(" ");
    for (var i = 0; i < splitStr.length; i++) {
        // You do not need to check if i is larger than splitStr length, as your for does that for you
        // Assign it back to the array
        splitStr[i] =
            splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }
    // Directly return the joined string
    return splitStr.join(" ");
}

/**
 * Deletes user and all relations by user id
 * @param userId
 * @throws SBError
 */
UserSchema.statics.deleteUser = async function (
    userId: mongoose.Types.ObjectId
): Promise<Object> {
    const user: any = await this.findById(userId).lean()
    if (!user)
        throw new SBError(404, 'User Not Found')

    // delete user
    return this.deleteOne({ _id: userId }).then()
}

/**
 * Search for user ids by name and email or id with same search value
 * @param search
 * @param limit
 */
UserSchema.statics.searchIds = async function (
    search: string,
    limit: number = 500
): Promise<Array<mongoose.Types.ObjectId>> {
    return (await this.find({
        $or: [
            { name: getSearchCriteria(search) },
            { email: getSearchCriteria(search) },
            ...(mongoose.isValidObjectId(search) ? [{ _id: search }] : [])
        ]
    }).limit(limit).distinct('_id').lean()) || []
}

UserSchema.statics.searchIdsMultipleField = async function (
    input: { [key: string]: any },
    fields: string | string[],
    limit: number = 500
): Promise<Array<mongoose.Types.ObjectId>> {
    return (await this.find(
        getSearchFilters(input, Array.isArray(fields) ? fields : [fields])
    ).limit(limit).distinct('_id').lean()) || []
}

const User: IUserModel = mongoose.model<IUser, IUserModel>("User", UserSchema);
export default User;
