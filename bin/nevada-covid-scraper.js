#!/usr/bin/env node
'use strict'

const { program } = require('commander');
const pkg = require('../package.json');
const scraper = require('../lib/scraper.js');

configure();
runProgram();

function configure() {
  program
    .version(pkg.version)
    .option(
      '-o, --output-file <path>',
      'file name of output results',
      './data.json'
    )
    .option(
      '-f, --output-format <format>',
      'output format of the file [json | csv]',
      'json'
    )
    .option(
      '-d, --debug'
    )
    .parse(process.argv);

}

function runProgram() {
  const options = {
    debug: program.debug,
    outputFile: program.outputFile,
    format: program.outputFormat
  }

  if(program.debug) { console.debug(options); }
  scraper(options);
}