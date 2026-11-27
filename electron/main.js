/**
 * Blockbench main process for the Windows 7 / 8 64-bit build.
 *
 * This is a port of the upstream ESM main process (`electron/main.js` from
 * Blockbench 5.x) to Electron 22. Electron 22 (Chromium 108, Node 16) is the
 * last release that still starts on Windows 7 SP1 and Windows 8.x, newer
 * versions abort at launch because they import APIs that only exist in
 * Windows 10's KERNEL32.dll (e.g. DiscardVirtualMemory).
 *
 * Electron 22 can not load an ESM main process, so this file is CommonJS and
 * the package is marked as such via `"type": "commonjs"` in package.json.
 */
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const http = require('http')
const { createRequire } = require('module')

// Paths that are relative to the app root
const app_root = path.join(__dirname, '..')
const index_path = path.join(app_root, 'index.html')

let all_wins = [];
let orig_win;
let load_project_data;

(() => {
	// Allow advanced users to specify a custom userData directory.
	// Useful for portable installations, and for setting up development environments.
	const index = process.argv.findIndex(arg => arg === '--userData');
	if (index !== -1) {
		if (!process.argv.at(index + 1)) {
			console.error('No path specified after --userData')
			process.exit(1)
		}
		app.setPath('userData', process.argv[index + 1]);
	}
})()

const LaunchSettings = {
	path: path.join(app.getPath('userData'), 'launch_settings.json'),
	settings: {},
	get(key) {
		return this.settings[key]
	},
	set(key, value) {
		this.settings[key] = value;
		let content = JSON.stringify(this.settings, null, '\t');
		fs.writeFileSync(this.path, content);
	},
	load() {
		try {
			if (fs.existsSync(this.path)) {
				let content = fs.readFileSync(this.path, 'utf-8');
				this.settings = JSON.parse(content);
			}
		} catch (error) {}
		return this;
	}
}.load();

const is_windows_7 = (() => {
	if (process.platform !== 'win32') return false;
	try {
		// Chromium 108 (Electron 22) reports "6.1.7601" on Windows 7 SP1 and
		// "6.2.9200" on Windows 8, while Windows 10/11 report 10.x
		return parseInt(process.getSystemVersion()) < 10;
	} catch (err) {
		return false;
	}
})()

/*
 * Hardware acceleration.
 *
 * Blockbench offers a "Restart without Hardware Acceleration" escape hatch when
 * it cannot create a WebGL context, and that writes `hardware_acceleration:
 * false` into launch_settings.json. That flag is permanent: every later launch
 * starts with app.disableHardwareAcceleration(), Chromium falls back to
 * SwiftShader software rendering, and the viewport runs at roughly 10 frames
 * per second forever, with no indication that the app never tried the GPU
 * again.
 *
 * Two things fix that:
 *
 * 1. An automatic fallback is recorded separately from a deliberate choice, so
 *    it can be retried on a later launch. A driver update, a Windows update or
 *    a re-plugged monitor can make the GPU usable again, and the user should
 *    not have to find a JSON file to benefit from that.
 * 2. Retries are capped. A machine that genuinely cannot render in hardware
 *    would otherwise fall back on every launch, which costs a broken window and
 *    a restart each time.
 *
 * A user who turns hardware acceleration off in the settings is never second
 * guessed: only fallbacks written by the escape hatch are retried.
 */
const SOFTWARE_RENDERING_RETRY_LIMIT = 2;

function shouldDisableHardwareAcceleration() {
	if (LaunchSettings.get('hardware_acceleration') != false) {
		return false;
	}

	// Only an automatic fallback is worth retrying.
	if (LaunchSettings.get('hardware_acceleration_fallback') != true) {
		return true;
	}

	const attempts = LaunchSettings.get('hardware_acceleration_retries') || 0;
	if (attempts >= SOFTWARE_RENDERING_RETRY_LIMIT) {
		return true;
	}

	// Count the attempt but leave `hardware_acceleration` alone. Flipping it
	// back to true here would take the early return above on the next launch
	// and the counter would never advance, so the app would retry forever.
	LaunchSettings.set('hardware_acceleration_retries', attempts + 1);
	console.log('[Blockbench] Retrying hardware acceleration, attempt ' + (attempts + 1));
	return false;
}

/**
 * Called by the renderer once it has a working WebGL context. That is the proof
 * the retry succeeded, so the fallback bookkeeping is cleared and the app stays
 * on the GPU from then on instead of burning the remaining retries.
 */
function confirmHardwareAcceleration() {
	if (LaunchSettings.get('hardware_acceleration_fallback') != true) return;
	LaunchSettings.set('hardware_acceleration_fallback', false);
	LaunchSettings.set('hardware_acceleration_retries', 0);
	LaunchSettings.set('hardware_acceleration', true);
	console.log('[Blockbench] Hardware acceleration confirmed working');
}

if (shouldDisableHardwareAcceleration()) {
	app.disableHardwareAcceleration();
	if (process.platform != 'win32') {
		app.commandLine.appendSwitch('enable-unsafe-swiftshader');
	}
}

/*
 * Chromium only allows a local page to load ES modules and to fetch local
 * files when file access from files is allowed. Blockbench ships as a single
 * ES module bundle loaded from index.html, so without this flag the app would
 * show "Incompatible browser version" on startup.
 */
app.commandLine.appendSwitch('allow-file-access-from-files')

const color_picker_require = createRequire(__filename)
function getColorHexRGB() {
	// electron-color-picker is an optional native helper. Never let a missing
	// or incompatible helper crash the main process.
	try {
		const ColorPicker = color_picker_require('electron-color-picker');
		return ColorPicker.getColorHexRGB()
	} catch (error) {
		console.warn('[Blockbench] Color picker is not available on this system', error)
		return Promise.resolve('')
	}
}

function createWindow(second_instance, options = {}) {
	if (app.requestSingleInstanceLock && !app.requestSingleInstanceLock()) {
		app.quit()
		return;
	}
	let native_frame = LaunchSettings.get('native_window_frame') === true;
	let win_options = {
		icon: path.join(app_root, 'icon.ico'),
		show: false,
		backgroundColor: '#21252b',
		frame: native_frame,
		titleBarStyle: native_frame ? 'default' : 'hidden',
		minWidth: 640,
		minHeight: 480,
		width: 1080,
		height: 720,
		webPreferences: {
			webgl: true,
			webSecurity: true,
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true
		}
	};
	if (options.position) {
		win_options.x = options.position[0] - 300;
		win_options.y = Math.max(options.position[1] - 100, 0);
	}
	let win = new BrowserWindow(win_options)
	if (!orig_win) orig_win = win;
	all_wins.push(win);

	// @electron/remote allows the renderer to use main process modules.
	// It is initialized lazily so that a broken module never prevents the
	// window from opening.
	const remote = require('@electron/remote/main')
	remote.initialize()
	remote.enable(win.webContents)

	if (process.platform === 'darwin') {

		let template = [
			{
				"label": "Blockbench",
				"submenu": [
					{ "role": "hide" },
					{ "role": "hideothers" },
					{ "role": "unhide" },
					{ "type": "separator" },
					{ "role": "quit" }
				]
			},
			{
				"label": "Edit",
				"submenu": [
					{ "role": "cut" },
					{ "role": "copy" },
					{ "role": "paste" },
					{ "role": "selectall" }
				]
			},
			{
				"label": "Window",
				"role": "window",
				"submenu": [
					{ "label": "Toggle Full Screen", "accelerator": "Ctrl+Command+F" },
					{ "role": "minimize" },
					{ "role": "close" },
					{ "type": "separator" },
					{ "role": "front" }
				]
			}
		]

		var osxMenu = Menu.buildFromTemplate(template);
		Menu.setApplicationMenu(osxMenu)
	} else {
		win.setMenu(null);
	}

	if (options.maximize !== false) win.maximize()

	win.loadURL(url.format({
		pathname: index_path,
		protocol: 'file:',
		slashes: true
	})).then(() => {
		win.show();
	}).catch((error) => {
		// Never leave the user with an invisible app. If the page fails to
		// load, show the window anyway so the error screen is visible.
		console.error('[Blockbench] Failed to load app window', error)
		win.show();
	});
	win.on('closed', () => {
		win = null;
		all_wins.splice(all_wins.indexOf(win), 1);
	})
	if (second_instance === true) {
		win.webContents.second_instance = true;
	}
	return win;
}

app.commandLine.appendSwitch('ignore-gpu-blacklist')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-accelerated-video')

app.on('second-instance', function (event, argv, cwd) {
	process.argv = argv;
	let win = all_wins.find(win => !win.isDestroyed());
	if (win && argv[argv.length-1 || 1] && argv[argv.length-1 || 1].substr(0, 2) !== '--') {
		win.webContents.send('open-model', argv[argv.length-1 || 1]);
		win.focus();
	} else {
		createWindow(true);
	}
})
app.on('open-file', function (event, path) {
	process.argv[process.argv.length-1 || 1] = path;
	let win = all_wins.find(win => !win.isDestroyed());
	if (win) {
		win.webContents.send('open-model', path);
	}
})

ipcMain.on('edit-launch-setting', (event, arg) => {
	if (arg.key === 'hardware_acceleration_confirmed' && arg.value === true) {
		confirmHardwareAcceleration();
		return;
	}
	LaunchSettings.set(arg.key, arg.value);
})
ipcMain.handle('get-launch-setting', (event, arg) => {
	return LaunchSettings.get(arg.key);
})
ipcMain.on('add-recent-project', (event, path) => {
	app.addRecentDocument(path);
})
ipcMain.on('dragging-tab', (event, value) => {
	all_wins.forEach(win => {
		if (win.isDestroyed() || win.id == event.sender.id) return;
		win.webContents.send('accept-detached-tab', JSON.parse(value));
	})
})
ipcMain.on('new-window', (event, data, position) => {
	if (typeof data == 'string') load_project_data = JSON.parse(data);
	if (position) {
		position = JSON.parse(position)
		let place_in_window = all_wins.find(win => {
			if (win.isDestroyed() || win.webContents == event.sender || win.isMinimized()) return false;
			let pos = win.getPosition();
			let size = win.getSize();
			return (position.offset[0] >= pos[0] && position.offset[0] <= pos[0] + size[0]
				 && position.offset[1] >= pos[1] && position.offset[1] <= pos[1] + size[1]);
		})
		if (place_in_window) {
			place_in_window.send('load-tab', load_project_data);
			place_in_window.focus();
			load_project_data = null;
		} else {
			createWindow(true, {
				maximize: false,
				position: position.offset
			});
		}
	} else {
		createWindow(true);
	}
})
ipcMain.on('close-detached-project', async (event, window_id, uuid) => {
	let window = all_wins.find(win => win.id == window_id);
	if (window) window.send('close-detached-project', uuid);
})
ipcMain.on('request-color-picker', async (event, arg) => {
	const color = await getColorHexRGB().catch((error) => {
		console.warn('[Error] Failed to pick color', error)
		return ''
	})
	if (color) {
		all_wins.forEach(win => {
			if (win.isDestroyed() || (!arg.sync && win.webContents.getProcessId() != event.sender.getProcessId())) return;
			win.webContents.send('set-main-color', color)
		})
	}
})
ipcMain.on('show-item-in-folder', async (event, path) => {
	shell.showItemInFolder(path);
})
ipcMain.on('open-in-default-app', async (event, path) => {
	shell.openPath(path);
})

app.on('ready', () => {

	const dev_mode = process.execPath && process.execPath.match(/node_modules[\\\/]electron/);

	createWindow();

	let app_was_loaded = false;
	ipcMain.on('app-loaded', () => {

		if (load_project_data) {
			all_wins[all_wins.length-1].send('load-tab', load_project_data);
			load_project_data = null;
		}

		if (app_was_loaded) {
			console.log('[Blockbench] App reloaded or new window opened')
			return;
		}

		app_was_loaded = true;

		// Automatic updates are disabled in the Windows 7 build. The upstream
		// updater would download the current Windows 10 only release, which
		// can not run on this system.
		if (LaunchSettings.get('check_for_updates') != false && !is_windows_7 && !dev_mode) {
			startAutoUpdater();
		}
	})
})

function startAutoUpdater() {
	let autoUpdater;
	try {
		autoUpdater = require('electron-updater').autoUpdater;
	} catch (error) {
		console.warn('[Blockbench] Updater is not available', error)
		return;
	}

	autoUpdater.autoInstallOnAppQuit = true;
	autoUpdater.autoDownload = false;
	if (LaunchSettings.get('update_to_prereleases') === true) {
		autoUpdater.allowPrerelease = true;
		//autoUpdater.channel = 'beta';
	}

	autoUpdater.on('update-available', (a) => {
		console.log('update-available', a)
		ipcMain.on('allow-auto-update', () => {
			autoUpdater.downloadUpdate()
		})
		if (!orig_win.isDestroyed()) orig_win.webContents.send('update-available', a);
	})
	autoUpdater.on('update-downloaded', (a) => {
		console.log('update-downloaded', a)
		if (!orig_win.isDestroyed()) orig_win.webContents.send('update-downloaded', a)
	})
	autoUpdater.on('error', (a) => {
		console.log('update-error', a)
		if (!orig_win.isDestroyed()) orig_win.webContents.send('update-error', a)
	})
	autoUpdater.on('download-progress', (a) => {
		console.log('update-progress', a)
		if (!orig_win.isDestroyed()) orig_win.webContents.send('update-progress', a)
	})
	autoUpdater.checkForUpdates().catch(err => {})
}

app.on('window-all-closed', () => {
	app.quit()
})
