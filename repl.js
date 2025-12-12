const fs = require("fs");
const repl = require('node:repl');

//eval(fs.readFileSync("./dist/index.js").toString());

const mangaRightSource = require("./dist/index.js");

const r = repl.start();

r.context.mangaRightSource = mangaRightSource
