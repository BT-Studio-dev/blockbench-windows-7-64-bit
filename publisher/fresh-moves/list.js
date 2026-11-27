// Renders the download list from the data written by
// scripts/fresh_moves_site.mjs. Kept separate from the generated file so the
// generated file stays a pure data payload.
(function () {
	var host = document.getElementById('downloads');
	var data = window.FRESH_MOVES;
	if (!host || !data || !data.builds) return;

	var newest = data.builds[0] ? data.builds[0].version : null;

	data.builds.forEach(function (build) {
		var link = document.createElement('a');
		link.className = 'card' + (build.version === newest ? ' primary-version' : '');
		link.href = build.href;
		link.setAttribute('download', build.file);

		var version = document.createElement('span');
		version.className = 'ver';
		version.textContent = build.version;

		var format = document.createElement('span');
		format.className = 'fmt';
		format.textContent = 'format ' + build.pack_format;

		var size = document.createElement('span');
		size.className = 'size';
		size.textContent = build.kilobytes + ' KB';

		link.append(version, format, size);

		if (build.version === newest) {
			var pill = document.createElement('span');
			pill.className = 'pill';
			pill.textContent = 'newest';
			link.append(pill);
		}

		host.append(link);
	});
})();
