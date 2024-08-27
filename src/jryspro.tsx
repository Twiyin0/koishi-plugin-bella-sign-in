import { jrysJson } from './jrys'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export class jryspro {
    constructor() {}
    async getJrys(uid:string|number, debug?: boolean) {
        const md5 = crypto.createHash('md5');
        const hash = crypto.createHash('sha256');
        let etime = new Date().setHours(0, 0, 0, 0);
        let userId:any;
        if (!isNaN(Number(uid))) {
          userId = uid;
        } else {
          if (uid) {
            hash.update(uid+String(etime));
            let hashhexDigest = hash.digest('hex');
            userId = Number(parseInt(hashhexDigest, 16)) % 1000000001;
          }
          else {
            md5.update("Default Jrys"+String(etime));
            let hexDigest = md5.digest('hex');
            userId = parseInt(hexDigest, 16) % 1000000001;
          }
        }
        var todayJrys = (((etime/100000)*userId%1000001)*2333)%(jrysJson.length);
        if(debug)
          return {"jrys": todayJrys, "etime": (etime/100000) }
        else
          return jrysJson[todayJrys];
    }
}
