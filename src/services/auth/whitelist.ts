import {settings} from "../../model/Settings";
import User, {ACCOUNT_VIEWER} from "../../model/Users";
import Whitelist from "../../model/Whitelist";

enum errors {
    ERR_WALLET_REQUIRED = 'walletRequired',
    ERR_WHITELIST_FORBIDDEN = 'forbidden'
}

/**
 * @param user
 */
const check = async (user: any): Promise<string | false> => {

    if (settings.get('useWhitelist') && user.accountType == ACCOUNT_VIEWER) {
        if (!user.address)
            return errors.ERR_WALLET_REQUIRED
        if (user.whitelisted)
            return false

        if (!await Whitelist.findOne({address: user.address.toLowerCase()}).lean())
            return errors.ERR_WHITELIST_FORBIDDEN

        await User.findByIdAndUpdate(user._id, {whitelisted: true})

        return false
    } else {
        return false
    }

}

export default {check, errors}