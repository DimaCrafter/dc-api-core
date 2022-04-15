// const { exec, spawn } = require('child_process');
const { exec: e, spawn: s } = require('child_process');
function exec (cmd, cb) {
	e(cmd.replace('dc-api-cli', 'node /Volumes/DATA/Projects/Node/dc-api-cli/index.js'), cb);
}

function spawn (cmd, args, opts) {
	if (cmd == 'dc-api-cli') {
		return s('node', ['/Volumes/DATA/Projects/Node/dc-api-cli/index.js', ...args], opts);
	} else {
		return s(cmd, args, opts);
	}
}

function prompt (question, list) {
	return new Promise(resolve => {
		process.stdout.write(question + ' ');
		process.stdin.resume();
		process.stdin.once('data', chunk => {
			process.stdin.pause();
			const answer = chunk.toString().replace(/\r?\n/, '').toLowerCase();
			if (list && !~list.indexOf(answer)) prompt(question, list).then(resolve);
			else resolve(answer);
		});
	});
}

function init () {
	prompt('Init dc-api-core project for you? [Y/n]:', ['', 'y', 'n']).then(isInit => {
		if (!isInit || isInit == 'y') {
			console.log('\n$ dc-api-cli init');
			spawn('dc-api-cli', ['init'], { stdio: 'inherit' });
		}
	});
}

exec('dc-api-cli --version', (err, stdout, stderr) => {
	if (err || stderr) {
		prompt('Install dc-api-cli globally (not required for production)? [Y/n]:', ['', 'y', 'n']).then(answer => {
			if (!answer || answer == 'y') {
				prompt('Select package manager\n1) npm\n2) Yarn\nAnswer:', ['1', '2']).then(pm => {
					switch (pm) {
						case '1':
							pm = 'npm install --global dc-api-cli';
							break;
						case '2':
							pm = 'yarn global add dc-api-cli';
							break;
					}

					console.log('\n$ ' + pm);
					pm = pm.split(' ');
					const pmProcess = spawn(pm[0], pm.slice(1), { stdio: 'inherit' });
					pmProcess.once('exit', code => {
						if (code) {
							prompt('Package manager exited with error, continue? [y/N]:', ['', 'y', 'n']).then(isContinue => {
								if (isContinue == 'y') init();
							});
						} else {
							init();
						}
					});
				});
			}
		});
	} else {
		stdout = stdout.toString().replace(/\r?\n/, '');
		console.log('Found dc-api-cli v' + stdout + ', skipping installation');
		init();
	}
});

