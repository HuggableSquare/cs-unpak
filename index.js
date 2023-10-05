import EventEmitter from 'events';
import fs from 'node:fs';
import VPK from 'vpk';
import hasha from 'hasha';
import winston from 'winston';

const APP_ID = 730;
const DEPOT_ID = 2347770;

const defaultConfig = {
	directory: 'data',
	logLevel: 'info'
};

function bytesToMB(bytes) {
	return (bytes / 1000000).toFixed(2);
}

export class CSUnpak extends EventEmitter {
	#ready = false;
	get ready() {
		return this.#ready || false;
	}

	get steamReady() {
		return !!this.user.steamID;
	}

	set ready(r) {
		const old = this.ready;
		this.#ready = r;

		if (r !== old && r) {
			this.log.debug('Ready');
			this.emit('ready');
		}
	}

	constructor(steamUser, config = {}) {
		super();

		if (!config.neededDirectories || !Array.isArray(config.neededDirectories)) {
			throw new Error('must supply directories to download');
		}

		this.config = Object.assign(defaultConfig, config);
		this.createDataDirectory();
		this.user = steamUser;

		this.log = winston.createLogger({
			level: config.logLevel,
			transports: [
				new winston.transports.Console({
					colorize: true,
					format: winston.format.printf((info) => {
						return `[cs-unpak] ${info.level}: ${info.message}`;
					})
				})
			]
		});

		if (!this.steamReady) {
			this.log.debug('Steam not ready, waiting for logon');
			this.user.once('loggedOn', () => {
				this.start();
			});
		} else {
			this.start();
		}
	}

	/**
	 * Creates the data directory specified in the config if it doesn't exist
	 */
	createDataDirectory() {
		const dir = `./${this.config.directory}`;

		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
	}

	async start() {
		this.update();

		this.user.on('appUpdate', () => {
			this.update();
		});
	}

	/**
	 * Returns the latest manifest ID for the DEPOT_ID
	 * @return {Promise<string>} Depot Manifest ID
	 */
	async getLatestManifestId() {
		this.log.debug('Obtaining latest manifest ID');
		const { apps } = await this.user.getProductInfo([APP_ID], [], true);
		const cs2 = apps[APP_ID].appinfo;
		const commonDepot = cs2.depots[DEPOT_ID];

		return commonDepot.manifests.public.gid;
	}

	/**
	 * Retrieves and updates the files from Valve
	 *
	 * Ensures that only the required VPK files are downloaded and that files with the same SHA1 aren't
	 * redownloaded
	 *
	 * @return {Promise<void>}
	 */
	async update() {
		this.log.info('Checking for CS2 file updates');

		if (!this.steamReady) {
			this.log.warn(`Steam not ready, can't check for updates`);
			return;
		}

		const manifestId = await this.getLatestManifestId();

		this.log.debug(`Obtained latest manifest ID: ${manifestId}`);

		const { manifest } = await this.user.getManifest(APP_ID, DEPOT_ID, manifestId, 'public');
		const dirFile = manifest.files.find((file) => file.filename.endsWith("csgo\\pak01_dir.vpk"));

		this.log.debug(`Downloading required static files`);

		await this.downloadFiles([dirFile]);

		this.log.debug('Loading static file resources');

		this.loadVPK();
		await this.downloadVPKFiles(manifest.files);

		this.ready = true;
	}

	/**
	 * Downloads the given VPK files from the Steam CDN
	 * @param files Steam Manifest File Array
	 * @return {Promise<Array>} Fulfilled when completed downloading
	 */
	async downloadFiles(files) {
		const promises = [];

		for (const file of files) {
			let name = file.filename.split('\\');
			name = name[name.length - 1];

			const path = `${this.config.directory}/${name}`;

			const isDownloaded = await this.isFileDownloaded(path, file.sha_content);

			if (isDownloaded) {
				continue;
			}

			const promise = this.user.downloadFile(APP_ID, DEPOT_ID, file, `${this.config.directory}/${name}`);
			promises.push(promise);
		}

		return Promise.all(promises);
	}

	/**
	 * Loads the CS2 dir VPK specified in the config
	 */
	loadVPK() {
		this.vpkDir = new VPK(this.config.directory + '/pak01_dir.vpk');
		this.vpkDir.load();
	}

	/**
	 * Given the CSGO VPK Directory, returns the necessary indices for the chosen options
	 * @return {Array} Necessary Sticker VPK Indices
	 */
	getRequiredVPKFiles() {
		const requiredIndices = new Set();

		for (const name in this.vpkDir.tree) {
			const file = this.vpkDir.tree[name];
			if (requiredIndices.has(file.archiveIndex)) break;

			for (const dir of this.config.neededDirectories) {
				if (name.startsWith(dir)) {
					requiredIndices.add(file.archiveIndex);
					break;
				}
			}
		}

		return Array.from(requiredIndices).sort();
	}

	/**
	 * Downloads the required VPK files
	 * @param manifestFiles Manifest files
	 * @return {Promise<void>}
	 */
	async downloadVPKFiles(manifestFiles) {
		this.log.debug('Computing required VPK files for selected packages');

		const requiredIndices = this.getRequiredVPKFiles();

		this.log.debug(`Required VPK files ${requiredIndices.join(', ')}`);

		for (let index in requiredIndices) {
			index = parseInt(index);

			// pad to 3 zeroes
			const paddedIndex = requiredIndices[index].toString().padStart(3, '0');
			const fileName = `pak01_${paddedIndex}.vpk`;

			const file = manifestFiles.find((f) => f.filename.endsWith(fileName));
			const filePath = `${this.config.directory}/${fileName}`;

			const isDownloaded = await this.isFileDownloaded(filePath, file.sha_content);

			if (isDownloaded) {
				this.log.info(`Already downloaded ${fileName}`);
				continue;
			}

			const status = `[${index + 1} / ${requiredIndices.length}]`;

			this.log.info(`${status} Downloading ${fileName} - ${bytesToMB(file.size)} MB`);

			await this.user.downloadFile(APP_ID, DEPOT_ID, file, filePath, (none, { type, bytesDownloaded, totalSizeBytes }) => {
				if (type === 'progress') {
					this.log.info(`${status} ${(bytesDownloaded * 100 / totalSizeBytes).toFixed(2)}% - ${bytesToMB(bytesDownloaded)} / ${bytesToMB(totalSizeBytes)} MB`);
				}
			});

			this.log.info(`${status} Downloaded ${fileName}`);
		}
	}

	/**
	 * Returns whether a file at the given path has the given sha1
	 * @param path File path
	 * @param sha1 File SHA1 hash
	 * @return {Promise<boolean>} Whether the file has the hash
	 */
	async isFileDownloaded(path, sha1) {
		try {
			const hash = await hasha.fromFile(path, { algorithm: 'sha1' });
			return hash === sha1;
		} catch (e) {
			return false;
		}
	}

	getFile(path) {
		return this.vpkDir.getFile(path);
	}
}
