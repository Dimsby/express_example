import {config} from "../../config";
import fetch from 'node-fetch';
import {logger} from "../logger";

const getToken = async (code: string) => {
    const data = {
        'client_id': config.discord.clientId,
        'client_secret': config.discord.clientSecret,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': config.discord.redirectUrl,
    };

    const discordRequest = await fetch("https://discord.com/api/oauth2/token", {
        method: 'POST',
        body: Object.keys(data).map(key => key + '=' + data[key]).join('&'), //JSON.stringify(data),
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    });
    const discordResponse: any = await discordRequest.json();
    const discordToken = discordResponse['access_token']

    if (!discordToken)
        logger.error('discord failed', discordResponse, code)

    return discordToken
}

const getDiscordId = async (token: string) => {
    const discordRequest = await fetch("https://discord.com/api/users/@me", {
        method: 'GET',
        headers: {'Authorization': `Bearer ${token}`}
    });

    const discordResponse = await discordRequest.json();
    const userId = discordResponse['id']

    if (!userId)
        logger.error('discord failed', discordResponse)

    return userId
}

const joinServer = async (token: string, discordUserId: string) => {
    const serverId = config.discord.serverId
    const botToken = config.discord.botToken

    await fetch(`https://discord.com/api/guilds/${serverId}/members/${discordUserId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${botToken}`
        },
        body: JSON.stringify({
            access_token: token
        })
    });

    return true;
}

export default {getToken, getDiscordId, joinServer}