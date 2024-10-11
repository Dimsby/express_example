import mongoose from "mongoose";
import {formatTimeDistance, getTimestamp} from "../utils/timeHelper";
import {sendNotificationEvent} from "../services/socketEvents";

// types
type ObjectIdType = mongoose.Types.ObjectId | string;

export enum ENotificationIcon {timer = 'timer', alert = 'alert'}

// fields to be removed from json output
let privateFields: string[] = ['userId', 'senderId', 'createdAt', 'updatedAt', '__v']
export const setPrivateFields = (v: string[]) => privateFields = v;

// interface
export interface INotification extends mongoose.Document {
    title: string,
    text: string,
    type?: string,
    icon?: string,
    userId: mongoose.Types.ObjectId,
    senderId?: mongoose.Types.ObjectId,
    isRead: boolean,
    createdAt: Date,
    updatedAt?: Date

    // virtuals
    time: string
    tm: number
}

// statics
interface INotificationModel extends mongoose.Model<INotification> {
    send(userId: ObjectIdType, data: object)

    setRead(userId: ObjectIdType, limit: number): Promise<Array<INotification>>

    getUnread(userId: ObjectIdType): Promise<Number>
}

// schema
export const NotificationsSchema = new mongoose.Schema({
    title: {type: String, required: true, max: 100},
    text: {type: String, required: true, max: 500},
    type: {type: String},
    icon: {type: String, enum: Object.values(ENotificationIcon)},
    userId: {type: mongoose.Types.ObjectId, required: true, index: true},
    senderId: {type: mongoose.Types.ObjectId},
    isRead: {type: Boolean, default: false},
    data: {type: Object},
}, {
    id: false,
    timestamps: true,
    toObject: {virtuals: true},
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            // delete private fields from output
            if (privateFields) privateFields.forEach(v => delete ret[v])
        }
    }
})

// virtuals

// created at time distance, e.g. "1 minute ago"
NotificationsSchema.virtual('time').get(function () {
    return formatTimeDistance(this.createdAt);
})

// created at timestamp
NotificationsSchema.virtual('tm').get(function () {
    return getTimestamp(this.createdAt)
})

// statics

/**
 * Create new notification and send it
 *
 * @param userId
 * @param data
 */
NotificationsSchema.statics.send = async function (userId: ObjectIdType, data: object) {
    const createData = {
        ...data,
        userId: userId,
    }

    return this.create(createData)
        .then((notification) => sendNotificationEvent(notification));
}

/**
 * Set read status of last unread notifications
 *
 * @param userId notifications owner
 * @param limit how much notifications to update
 */
NotificationsSchema.statics.setRead = async function (userId: ObjectIdType, limit: number = 5) {
    const ids = await this.find({userId: userId, isRead: false})
        .select(['_id'])
        .sort('-createdAt')
        .limit(limit)

    return this.updateMany({_id: {$in: ids}}, {isRead: true})
}

NotificationsSchema.statics.getUnread = async function (userId: ObjectIdType): Promise<Number> {
    return this.where({'userId': userId, 'isRead': false}).count()
}

const Notifications: INotificationModel = mongoose.model<INotification, INotificationModel>('Notification', NotificationsSchema);
export default Notifications;