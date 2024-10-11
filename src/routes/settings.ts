import express from "express";
import * as settings from "../controllers/settings";
import {auth, authAdmin, authAnon} from "../middlewares/auth";

const settingsRouter = express.Router();

settingsRouter.get('/', authAnon, settings.main.getAction);

settingsRouter.get('/:field', auth, settings.item.getAction);
settingsRouter.put('/:field', authAdmin, settings.item.putAction);

export {settingsRouter}