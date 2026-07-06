import { spawn } from 'node:child_process'

const npmCommand = 'npm'
const processes = [
  {
    name: 'api',
    args: ['run', 'dev:api'],
    env: { PORT: process.env.PORT ?? '4173' },
  },
  {
    name: 'web',
    args: ['run', 'dev:web'],
    env: {},
  },
]

let shuttingDown = false
const children = processes.map((processConfig) => {
  const useShell = process.platform === 'win32'
  const command = useShell ? [npmCommand, ...processConfig.args].join(' ') : npmCommand
  const args = useShell ? [] : processConfig.args
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...processConfig.env },
    shell: useShell,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const prefix = `[${processConfig.name}]`
  child.stdout.on('data', (chunk) => writePrefixed(process.stdout, prefix, chunk))
  child.stderr.on('data', (chunk) => writePrefixed(process.stderr, prefix, chunk))
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    shuttingDown = true
    stopChildren()
    if (signal) {
      process.exitCode = 1
      console.error(`${prefix} exited via ${signal}`)
      return
    }
    process.exitCode = code ?? 0
    if (code !== 0) console.error(`${prefix} exited with code ${code}`)
  })

  return child
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    shuttingDown = true
    stopChildren()
    process.exit(0)
  })
}

function writePrefixed(stream, prefix, chunk) {
  String(chunk)
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((line) => stream.write(`${prefix} ${line}\n`))
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
}
