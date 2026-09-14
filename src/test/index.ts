//	Imports ____________________________________________________________________

import * as path from 'path';
import * as glob from 'glob';
import Mocha from 'mocha';

//	Variables __________________________________________________________________

const mocha = new Mocha({
	ui: 'bdd',
	color: true,
});

const files = glob.sync('**/*.test.js', {
	cwd: __dirname,
});

//	Initialize _________________________________________________________________

files.forEach((file) => mocha.addFile(path.resolve(__dirname, file)));

mocha.run((failures) => {
	process.exitCode = failures ? 1 : 0;
});

//	Exports ____________________________________________________________________



//	Functions __________________________________________________________________

