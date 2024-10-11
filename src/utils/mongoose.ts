import mongoose from "mongoose";
import {config} from "../config";
import {logger} from "../services/logger";
import userSearchRequest from "../requests/user/search";

export const connectDB = async () => {
    console.log(`Trying to connect to MongoDB. Config: `, config.db);

    await mongoose.connect(config.db.connect_string).catch((err) => {
        logger.error('MONGO ERROR', err);
    });

    console.log('mongoose is Connected');
    mongoose.set('debug', false);
}

export const arrayToProjection = (arr: string[], num: number = 1): { [key: string]: number} => arr.reduce(
    (fields: { [key: string]: number }, field: string) => {
        fields[field] = num
        return fields
    }, {})