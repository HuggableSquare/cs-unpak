import SteamUser from 'steam-user';
import CSUnpak from './index.js';
import { writeFile } from 'fs/promises';

const cred = {
	accountName: 'USERNAME',
	password: 'PASSWORD',
};

const user = new SteamUser({ enablePicsCache: true });
const unpak = new CSUnpak(user, { logLevel: 'debug', neededDirectories: ['scripts/items'] });

user.logOn(cred);

unpak.on('ready', () => {
	writeFile('items_game.txt', unpak.getFile('scripts/items/items_game.txt'));
	writeFile('items_game_cdn.txt', unpak.getFile('scripts/items/items_game_cdn.txt'));
});
