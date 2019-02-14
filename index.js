#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const program = require('commander')
const pMap = require('p-map')
const globby = require('globby')
const deepEqual = require('fast-deep-equal')
const sharp = require('sharp')

const { name, version } = require('./package')

module.exports = async (argv) => {
  program
    .name(name)
    .version(version)
    .usage(`${name} <folder1> <folder2>`)
    .option('-c, --concurrency <n>', 'Number of images to process concurrently', (s) => parseInt(s), 1)

  program.parse(argv)

  if (program.args.length < 2) {
    console.error('must pass two folders to compare')
    program.outputHelp()
    process.exit(1)
  }

  const dir0 = program.args[0]
  const dir1 = program.args[1]
  const images = await globby('**/*.png', { cwd: dir0 })

  const results = await pMap(images, async (file) => {
    const image0 = path.resolve(dir0, file)
    const image1 = path.resolve(dir1, file)

    if (!fs.existsSync(image0)) {
      throw new Error(`Image not found [${image0}]`)
    }

    if (!fs.existsSync(image1)) {
      throw new Error(`Image not found [${image1}]`)
    }

    const r0 = await sharp(image0).raw().toBuffer({ resolveWithObject: true })
    const r1 = await sharp(image1).raw().toBuffer({ resolveWithObject: true })

    if (!deepEqual(r0.info, r1.info)) {
      return {
        image0,
        image1,
        isEqual: false,
        reason: 'metadata'
      }
    }

    if (!r0.data.equals(r1.data)) {
      return {
        image0,
        image1,
        isEqual: false,
        reason: 'data'
      }
    }

    return {
      image0,
      image1,
      isEqual: true
    }
  }, {
    concurrency: program.concurrency
  })

  const isEqual = results.filter((r) => r.isEqual)
  const notEqual = results.filter((r) => !r.isEqual)

  console.log(`equal ${isEqual.length}`)
  console.log(`not equal ${notEqual.length}`)
  console.log(JSON.stringify(notEqual, null, 2))
}

module.exports(process.argv)
  .catch((err) => {
    console.error('error', err)
    process.exit(1)
  })
