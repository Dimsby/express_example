import express from "express";
const path = require('path');

export const getAction = async (req: any, res: express.Response, next: any) => {
    res.sendFile(path.join(__dirname, "../../views", "html", "socket.html"));
}

export const getSendAction = async (req: any, res: express.Response, next: any) => {

}
