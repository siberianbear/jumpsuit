import path from 'path'
import fs from 'fs-promise'
import glob from 'glob'
import chokidar from 'chokidar'
import { debounce } from '../utils/common'
import serve from './serve'
import { getConfig } from './config'
import { outputLogo, pending, pendingDone, error } from './emit'
import { buildJs } from './compilers/javascript'
import { buildAsset } from './compilers/assets'
// import { buildStylus } from './compilers/stylus'

export default function (argv) {
  outputLogo({ indent: 1 })

  glob(`${getConfig().source}/**/*`, { nodir: true }, (err, files) => {
    if (err) return error(err)
    files.forEach(async (file) => await handleEvent('add', file))
  })
}

export async function watch (argv) {
  outputLogo({ indent: 1 })

  const { source, output } = getConfig()

  fs.emptyDirSync(output)
  const watcher = chokidar.watch(source, {
    persistent: true,
    ignored: /[\/\\](\.)|node_modules|bower_components/,
  })

  watcher.on('all', handleEvent)
  await serve(argv)
}

let evtCount = 0
let buildTime
const isBuilding = debounce(() => pending('building'))
const isDone = debounce((time) => pendingDone(time))

export async function handleEvent (evt, file) {
  /* skip dir events */
  if (evt.match(/Dir$/)) return

  /* output build message and start timer */
  if (++evtCount === 1) {
    buildTime = Date.now()
    isBuilding()
  }

  try {
    /* determine action based on file extension */
    const ext = path.extname(file)
    if (getConfig().browserify.extensions.has(ext)) {
      await buildJs(evt, file)
    } else {
      await buildAsset(evt, file)
    }

    // switch (path.extname(file).slice(1)) {
    //   case 'js':
    //   case 'css':
    //     await buildJs(evt, file)
    //     break
    //   // case 'styl':
    //   //   await buildStylus(evt, file)
    //   //   break
    //   default:
    //     await buildAsset(evt, file)
    //     break
    // }
  } catch (err) {
    evtCount--
    return error(err, true)
  }

  /* output build complete and build time */
  if (--evtCount === 0) {
    isDone(Date.now() - buildTime)
  }
}
