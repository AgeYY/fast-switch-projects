//	Imports ____________________________________________________________________

const child_process = require('node:child_process');

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

module.exports = [
	{
		name: 'run',
		watch: 'test/**/*.js',
		task: (done) => {
			
			const tests = child_process.spawn(process.execPath, ['test/index.js'])
				.on('error', done)
				.on('close', (code) => done(code ? new Error(`Tests exited with ${code}`) : undefined));
			
			let logger = (buffer) => buffer.toString().split(/\n/).forEach((message) => message && console.log(message));
			
			tests.stdout.on('data', logger);
			tests.stderr.on('data', logger);
			
		},
	},
];

//	Functions __________________________________________________________________
