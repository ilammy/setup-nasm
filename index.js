const core = require('@actions/core')
const AdmZip = require('adm-zip')
const spawn = require('child_process').spawnSync
const fs = require('fs')
const fetch = require('node-fetch')
const path = require('path')
const process = require('process')
const URL = require('url').URL

// This could have been a ten-line shell script, but no, we are full-stack async now...
// Though, it does look pretty in the Web console.

// These are platform names as expected by NASM build archive
function selectPlatform(platform) {
    if (platform) { return platform }
    if (process.platform == 'linux')  { return 'linux' }
    if (process.platform == 'darwin') { return 'macosx' }
    if (process.platform == 'win32')  { return 'win64' }
    throw new Error(`unsupported platform: '${process.platform}'`)
}

async function main() {
    const version = core.getInput('version', {required: true})
    const destination = core.getInput('destination') || 'nasm'
    const from_source = core.getInput('from-source')
    // Yeah, these are strings... JavaScript at its finest
    const try_binary = (from_source != 'true')
    const try_source = (from_source != 'false')
    const platform = selectPlatform(core.getInput('platform'))

    const homedir = require('os').homedir()
    const absNasmDir = path.resolve(homedir, destination)
    const nasm = (process.platform == 'win32' ? 'nasm.exe' : 'nasm')
    const absNasmFile = path.join(absNasmDir, nasm)

    if (!fs.existsSync(absNasmDir)) {
        fs.mkdirSync(absNasmDir, {recursive: true})
    }

    // NASM publishes borked macOS binaries for older releases. Modern macOS
    // does not support 32-bit binaries and for some reason throws "Bad CPU type"
    // errors if a binary contain 32-bit code slice. Build old versions from source.
    if (platform == 'macos') {
        let match = version.match(/^(\d+)\.(\d+)/)
        let major = parseInt(match[1])
        let minor = parseInt(match[2])
        if (major < 2 || (major == 2 && minor < 14)) {
            core.info(`Requested NASM version ${version} has incompatible prebuilt binaries.`)
            core.info(`Only source builds are supported on macOS.`)
            if (try_source) {
                core.info(`Will try building from source.`)
                try_binary = false
            } else {
                core.warning(`Trying binary build at your own risk.`)
            }
        }
    }

    async function downloadBinary() {
        const url = new URL(`https://www.nasm.us/pub/nasm/releasebuilds/${version}/${platform}/nasm-${version}-${platform}.zip`)
        const buffer = await fetchBuffer(url)
        const zip = new AdmZip(buffer)

        // Pull out the one binary we're interested in from the downloaded archive,
        // overwrite anything that's there, and make sure the file is executable.
        const nasmEntry = `nasm-${version}/${nasm}`
        zip.extractEntryTo(nasmEntry, absNasmDir, false, true)
        if (!fs.existsSync(absNasmFile)) {
            core.debug(`nasm executable missing: ${absNasmFile}`)
            throw new Error(`failed to extract to '${absNasmDir}'`)
        }
        fs.chmodSync(absNasmFile, '755')

        core.debug(`extracted NASM to '${absNasmDir}'`)
    }

    async function buildFromSource() {
        const url = new URL(`https://www.nasm.us/pub/nasm/releasebuilds/${version}/nasm-${version}.zip`)
        const buffer = await fetchBuffer(url)
        const zip = new AdmZip(buffer)

        zip.extractAllTo(absNasmDir)

        // NASM uses the usual "./configure && make" but ZIP makes it harder.
        // First of all, configure shell script usually ends up with Windows
        // line endings which breaks the shebang line on non-Windows machines.
        const configurePath = path.join(absNasmDir, 'configure')
        if (!fs.existsSync(configurePath)) {
            core.debug(`configure script missing: ${configurePath}`)
            throw new Error(`failed to extract to '${absNasmDir}'`)
        }
        dos2unix(configurePath)
        fs.chmodSync(configurePath, '755')

        // Now we can run "./configure". Node.js does not allow to change current
        // working directory for the current process, so we use absolute paths.
        execute([configurePath], {cwd: absNasmDir})

        // Now comes the fun part! Somehow, despite smoking Autocrack, NASM manages
        // to botch up platform detection. Or that's Apple thinking different again,
        // I don't know. Whatever it is, here are magic patches to make things work.
        if (platform == 'linux' || platform == 'macosx') {
            if (version.match(/2.14/)) {
                appendFile(path.join(absNasmDir, 'include/compiler.h'), [
                    '#include <time.h>'
                ])
            }
        }
        if (platform == 'macosx') {
            if (version.match(/2.14/)) {
                appendFile(path.join(absNasmDir, 'config/config.h'), [
                    '#define HAVE_SNPRINTF 1',
                    '#define HAVE_VSNPRINTF 1',
                    '#define HAVE_INTTYPES_H 1'
                ])
            }
            if (version.match(/2.13/)) {
                appendFile(path.join(absNasmDir, 'config/config.h'), [
                    '#define HAVE_STRLCPY 1',
                    '#define HAVE_DECL_STRLCPY 1',
                    '#define HAVE_SNPRINTF 1',
                    '#define HAVE_VSNPRINTF 1',
                    '#define HAVE_INTTYPES_H 1'
                ])
            }
            if (version.match(/2.12/)) {
                appendFile(path.join(absNasmDir, 'config.h'), [
                    '#define HAVE_STRLCPY 1',
                    '#define HAVE_DECL_STRLCPY 1',
                    '#define HAVE_SNPRINTF 1',
                    '#define HAVE_VSNPRINTF 1'
                ])
            }
        }

        // Finally, build the damn binary.
        execute(['make', 'nasm'], {cwd: absNasmDir})

        core.debug(`compiled NASM in '${absNasmDir}'`)
    }

    var made_it = false
    if (try_binary && !made_it) {
        try {
            core.info('Downloading binary distribution...')
            await downloadBinary()
            made_it = true
        }
        catch (error) {
            core.warning(`binaries did not work: ${error}`)
        }
    }
    if (try_source && !made_it) {
        try {
            core.info('Downloading source code...')
            await buildFromSource()
            made_it = true
        }
        catch (error) {
            core.warning(`source code did not work: ${error}`)
        }
    }
    if (!made_it) {
        throw new Error("I'm sorry, Dave. I'm afraid I can't do that.")
    }

    execute([absNasmFile, '-version'])
    core.addPath(absNasmDir)
}

function execute(cmdline, extra_options) {
    core.startGroup(`${cmdline.join(' ')}`)
    const options = {stdio: 'inherit'}
    Object.assign(options, extra_options)
    const result = spawn(cmdline[0], cmdline.slice(1), options)
    core.endGroup()
    if (result.error) {
        core.debug(`failed to spawn process: ${result.error}`)
        throw result.error
    }
    if (result.status !== 0) {
        const command = path.basename(cmdline[0])
        const error = new Error(`${command} failed: exit code ${result.status}`)
        core.debug(`${error}`)
        throw error
    }
    return result
}

function dos2unix(path) {
    const converted = path + '.unix'
    const content = fs.readFileSync(path, {encoding: 'utf8'})
    const unixified = content.replace(/\r\n/g, '\n')
    fs.writeFileSync(converted, unixified, {encoding: 'utf8'})
    fs.renameSync(converted, path)
}

function appendFile(path, strings) {
    fs.appendFileSync(path, '\n' + strings.join('\n') + '\n')
}

async function fetchBuffer(url) {
    core.debug(`downloading ${url}...`)
    const result = await fetch(url)
    if (!result.ok) {
        const error = new Error(`HTTP GET failed: ${result.statusText}`)
        core.debug(`failed to fetch URL: ${error}`)
        throw error
    }
    const buffer = await result.buffer()
    core.debug(`fetched ${buffer.length} bytes`)
    return buffer
}

main().catch(() => core.setFailed('could not install NASM'))
