import { isIP } from 'node:net'
import { networkInterfaces } from 'node:os'

// Las interfaces virtuales (docker, puentes) no son alcanzables desde el celular de la escuela
const VIRTUAL_INTERFACES = ['docker', 'br-', 'veth', 'virbr', 'lo']

export function localNetworkHost(): string | null {
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (!addresses || VIRTUAL_INTERFACES.some((prefix) => name.startsWith(prefix))) continue
    const ipv4 = addresses.find((address) => address.family === 'IPv4' && !address.internal)
    if (ipv4) return ipv4.address
  }
  return null
}

// localhost o una IP vieja no sirven desde el celular: se usa la IP actual de la red local.
// Un dominio (despliegue) se deja como está.
export function withLocalHost(url: string): string {
  if (process.env.NODE_ENV === 'production') return url
  const parsed = new URL(url)
  if (parsed.hostname !== 'localhost' && !isIP(parsed.hostname)) return url
  const host = localNetworkHost()
  if (!host) return url
  parsed.hostname = host
  return parsed.toString()
}
