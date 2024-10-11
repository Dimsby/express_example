import express from 'express';
import User from '../model/Users';
import jwt from 'jsonwebtoken';
import {config} from '../config';
import * as helper from '../helper';

const refreshTokenAuth = (req: express.Request, res: express.Response, next:any) => {
    let token = req.cookies.auth;
    jwt.verify(token, config.auth.jwt_secret, async function(err:any, decoded:any) {
      if(err) {
        if(err.message === 'jwt expired') {
          const data: any = jwt.decode(token);

          req.user = { info: { id: data.id, name: data.name } };

          return next();
        }else {
          console.log(err);
          return helper.generateErr(res, err.message, 401);
        }
      } else {
       
        req.user = { info: {id: decoded.id, name: decoded.name} };
        next();
      }
    });
}

export { refreshTokenAuth }

